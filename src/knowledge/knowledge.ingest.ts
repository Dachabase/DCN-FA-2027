import crypto from "node:crypto";

import path from "node:path";

import {
  extractDocument,
} from "./knowledge.extractor";

import {
  chunkText,
} from "./knowledge.chunker";

import {
  embedTexts,
} from "./embedding.service";

import {
  createKnowledgeSourceWithChunks,
  findKnowledgeSourceByContentChecksum,
} from "./knowledge.service";

import type {
  KnowledgeSourceType,
  KnowledgeAuthority,
} from "../generated/prisma/client";

// =========================================================
// TYPES
// =========================================================

export interface IngestDocumentOptions {
  filePath: string;

  title: string;

  description?: string;

  facultyId: string;

  departmentId?: string;

  courseCode?: string;

  courseName?: string;

  level?: number;

  authority?: KnowledgeAuthority;

  version?: string;

  publishedAt?: Date;

  expiresAt?: Date;

  checksum?: string;

  metadata?: unknown;
}

// =========================================================
// DETERMINE SOURCE TYPE
// =========================================================

function determineSourceType(
  filePath: string
): KnowledgeSourceType {
  const extension =
    path
      .extname(filePath)
      .toLowerCase();

  switch (extension) {
    case ".pdf":
      return "PDF";

    case ".pptx":
    case ".ppt":
      return "POWERPOINT";

    case ".docx":
    case ".doc":
      return "WORD_DOCUMENT";

    case ".jpg":
    case ".jpeg":
    case ".png":
      return "SCANNED_IMAGE";

    case ".txt":
      return "OTHER";

    case ".md":
      return "OTHER";

    default:
      throw new Error(
        `Unsupported file type: ${extension}`
      );
  }
}

// =========================================================
// SANITIZE EXTRACTED TEXT
// =========================================================
//
// Some PDFs (especially ones with unusual embedded fonts or
// malformed encoding) yield extracted text containing NUL
// bytes or other control characters. Postgres' UTF8 encoding
// rejects NUL bytes outright (error 22021), so we strip
// control characters here before the text ever reaches
// chunking or the database. \n, \r, \t are preserved.
//

function sanitizeExtractedText(
  text: string
): string {
  return text.replace(
    /[\x00-\x08\x0B\x0C\x0E-\x1F]/g,
    ""
  );
}

// =========================================================
// DUPLICATE CONTENT ERROR
// =========================================================
//
// Thrown when a file's chunked content matches an already-
// ingested ACTIVE source's content, even though the raw
// file bytes differ (so the file-checksum dedup check in
// createKnowledgeSourceWithChunks's caller didn't catch it).
// Callers (e.g. the batch ingester) should treat this as a
// skip, not a failure.
//

export class DuplicateContentError extends Error {
  constructor(
    public existingSourceId: string
  ) {
    super(
      `Content matches existing source ${existingSourceId}.`
    );
    this.name =
      "DuplicateContentError";
  }
}

function computeContentChecksum(
  chunks: Array<{
    content: string;
  }>
): string | undefined {
  const joined =
    chunks
      .map(
        (c) => c.content
      )
      .join("\n\n");

  // See dedupe-content.ts for why this threshold exists —
  // short/near-empty extractions from different documents
  // can coincidentally be byte-identical (shared boilerplate,
  // OCR noise), which would otherwise cause false-positive
  // duplicate matches between genuinely different files.
  if (
    joined.length < 500
  ) {
    return undefined;
  }

  return crypto
    .createHash("sha256")
    .update(joined)
    .digest("hex");
}

// =========================================================
// INGEST DOCUMENT
// =========================================================

export async function ingestDocument(
  options: IngestDocumentOptions
) {
  console.log(
    "========================================"
  );

  console.log(
    "[KNOWLEDGE] Starting document ingestion"
  );

  console.log(
    `[KNOWLEDGE] File: ${options.filePath}`
  );

  console.log(
    `[KNOWLEDGE] Title: ${options.title}`
  );

  console.log(
    `[KNOWLEDGE] Faculty ID: ${options.facultyId}`
  );

  if (
    options.departmentId
  ) {
    console.log(
      `[KNOWLEDGE] Department ID: ${options.departmentId}`
    );
  }

  // -------------------------------------------------------
  // DETERMINE TYPE
  // -------------------------------------------------------

  const type =
    determineSourceType(
      options.filePath
    );

  console.log(
    `[KNOWLEDGE] Source type: ${type}`
  );

  // -------------------------------------------------------
  // EXTRACT
  // -------------------------------------------------------

  console.log(
    "[KNOWLEDGE] Extracting document text..."
  );

  const extracted =
    await extractDocument(
      options.filePath
    );

  const sanitizedText =
    sanitizeExtractedText(
      extracted.text
    );

  console.log(
    `[KNOWLEDGE] Extracted ${sanitizedText.length} characters.`
  );

  if (
    !sanitizedText.trim()
  ) {
    throw new Error(
      "Document extraction produced no text."
    );
  }

  // -------------------------------------------------------
  // CHUNK
  // -------------------------------------------------------

  console.log(
    "[KNOWLEDGE] Chunking document..."
  );

  const chunks =
    chunkText(
      sanitizedText
    );

  console.log(
    `[KNOWLEDGE] Created ${chunks.length} chunks.`
  );

  if (
    chunks.length === 0
  ) {
    throw new Error(
      "Document produced no knowledge chunks."
    );
  }

  // -------------------------------------------------------
  // CONTENT-LEVEL DUPLICATE CHECK
  // -------------------------------------------------------
  //
  // Catches files that differ at the byte level (different
  // metadata, re-export) but contain identical text content,
  // which the caller's file-checksum check cannot catch.
  //

  const contentChecksum =
    computeContentChecksum(
      chunks
    );

  if (contentChecksum) {
    const existingByContent =
      await findKnowledgeSourceByContentChecksum(
        options.facultyId,
        contentChecksum
      );

    if (existingByContent) {
      console.log(
        `[KNOWLEDGE] Content matches existing source ${existingByContent.id} — skipping as duplicate.`
      );

      throw new DuplicateContentError(
        existingByContent.id
      );
    }
  }

  // -------------------------------------------------------
  // EMBED CHUNKS
  // -------------------------------------------------------
  //
  // Computed here (outside the DB transaction) since it's a
  // network call — holding a Postgres transaction open across
  // a slow external API call risks lock contention/timeouts.
  //

  console.log(
    "[KNOWLEDGE] Embedding chunks..."
  );

  let embeddings: number[][];

  try {
    embeddings =
      await embedTexts(
        chunks.map(
          (c) => c.content
        ),
        "RETRIEVAL_DOCUMENT"
      );
  } catch (embeddingError) {
    console.error(
      "[KNOWLEDGE] Embedding failed — continuing without embeddings for this document (keyword search will still work).",
      embeddingError instanceof
        Error
        ? embeddingError.message
        : embeddingError
    );

    embeddings = [];
  }

  const chunksWithEmbeddings =
    chunks.map(
      (chunk, index) => ({
        ...chunk,
        embedding:
          embeddings[index],
      })
    );

  // -------------------------------------------------------
  // CREATE SOURCE + CHUNKS (ATOMIC)
  // -------------------------------------------------------

  console.log(
    "[KNOWLEDGE] Creating KnowledgeSource and chunks..."
  );

  const { source, chunks: savedChunks } =
    await createKnowledgeSourceWithChunks(
      {
        title:
          options.title,

        description:
          options.description,

        type,

        fileName:
          path.basename(
            options.filePath
          ),

        facultyId:
          options.facultyId,

        departmentId:
          options.departmentId,

        courseCode:
          options.courseCode,

        courseName:
          options.courseName,

        level:
          options.level,

        authority:
          options.authority ??
          "GENERAL",

        version:
          options.version,

        publishedAt:
          options.publishedAt,

        expiresAt:
          options.expiresAt,

        checksum:
          options.checksum,

        contentChecksum,

        metadata:
          options.metadata,
      },
      chunksWithEmbeddings
    );

  console.log(
    `[KNOWLEDGE] Source created: ${source.id}`
  );

  console.log(
    `[KNOWLEDGE] Saved ${savedChunks.length} knowledge chunks.`
  );

  console.log(
    "[KNOWLEDGE] Document ingestion completed."
  );

  console.log(
    "========================================"
  );

  return {
    source,
    chunks:
      savedChunks,
  };
}