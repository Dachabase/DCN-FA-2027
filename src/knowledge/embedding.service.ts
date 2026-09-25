import "dotenv/config";

import {
  GoogleGenAI,
} from "@google/genai";

// =========================================================
// EMBEDDING SERVICE
// =========================================================
//
// Wraps Gemini's embedContent API for M4 (semantic
// retrieval). Kept as its own module rather than reusing
// ai.service.ts's client so embedding calls (batch, high
// volume during ingestion) stay clearly separated from
// chat-completion calls.
//
// Model choice: gemini-embedding-001 — the current stable,
// generally-available, text-focused embedding model. There
// is a newer gemini-embedding-2-preview (multimodal), but
// "preview" models can change or be deprecated without much
// notice, which is a bad fit for a column of stored vectors
// that would all need re-embedding if the model changed
// shape. Revisit if/when a multimodal-2 model reaches GA.
//
// Dimensionality: the model outputs 3072 dimensions by
// default, but supports Matryoshka Representation Learning
// (MRL), which allows truncating to a smaller dimension
// (768 here) with graceful quality degradation. 768 keeps
// storage and in-memory cosine-similarity cost far lower for
// a large corpus, at a small, well-documented quality cost.
//
// Task type: Gemini's retrieval quality depends on telling
// it whether text being embedded is a document being
// indexed or a query being searched with — using the wrong
// one measurably hurts retrieval quality, so this is not
// optional.
//

export type EmbeddingTaskType =
  | "RETRIEVAL_DOCUMENT"
  | "RETRIEVAL_QUERY";

const EMBEDDING_MODEL =
  "gemini-embedding-001";

const EMBEDDING_DIMENSIONS = 768;

// Gemini's embedContent accepts an array of strings per
// call. Batching keeps the ~13k-chunk backfill to roughly
// 130 API calls instead of 13,000.
const EMBEDDING_BATCH_SIZE = 100;

const apiKey =
  process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error(
    "GEMINI_API_KEY is not configured. Add it to your .env file."
  );
}

const ai = new GoogleGenAI({
  apiKey,
});

function chunkArray<T>(
  items: T[],
  size: number
): T[][] {
  const batches: T[][] = [];

  for (
    let i = 0;
    i < items.length;
    i += size
  ) {
    batches.push(
      items.slice(
        i,
        i + size
      )
    );
  }

  return batches;
}

const MAX_RETRIES = 5;

const BASE_RETRY_DELAY_MS = 10_000;

function sleep(
  ms: number
): Promise<void> {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        ms
      )
  );
}

function isRateLimitError(
  error: unknown
): boolean {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  return (
    message.includes(
      "429"
    ) ||
    message.includes(
      "RESOURCE_EXHAUSTED"
    )
  );
}

async function embedBatchWithRetry(
  batch: string[],
  taskType: EmbeddingTaskType
) {
  let lastError: unknown;

  for (
    let attempt = 0;
    attempt < MAX_RETRIES;
    attempt++
  ) {
    try {
      return await ai.models.embedContent(
        {
          model:
            EMBEDDING_MODEL,

          contents: batch,

          config: {
            outputDimensionality:
              EMBEDDING_DIMENSIONS,

            taskType,
          },
        }
      );
    } catch (error) {
      lastError = error;

      if (
        !isRateLimitError(
          error
        )
      ) {
        throw error;
      }

      const delay =
        BASE_RETRY_DELAY_MS *
        Math.pow(
          2,
          attempt
        );

      console.warn(
        `[EMBEDDING] Rate limited (attempt ${attempt + 1}/${MAX_RETRIES}). Waiting ${Math.round(delay / 1000)}s before retrying...`
      );

      await sleep(
        delay
      );
    }
  }

  throw lastError;
}

// =========================================================
// EMBED TEXTS
// =========================================================
//
// Embeds an array of texts and returns their vectors in the
// same order. Handles batching internally — callers do not
// need to worry about the API's per-call size limits.
//

export async function embedTexts(
  texts: string[],
  taskType: EmbeddingTaskType
): Promise<number[][]> {
  if (
    texts.length === 0
  ) {
    return [];
  }

  const batches =
    chunkArray(
      texts,
      EMBEDDING_BATCH_SIZE
    );

  const results: number[][] =
    [];

  for (const batch of batches) {
    const response =
      await embedBatchWithRetry(
        batch,
        taskType
      );

    const embeddings =
      response.embeddings;

    if (
      !embeddings ||
      embeddings.length !==
        batch.length
    ) {
      throw new Error(
        `Embedding API returned ${embeddings?.length ?? 0} vectors for a batch of ${batch.length} texts.`
      );
    }

    for (const embedding of embeddings) {
      const values =
        embedding.values;

      if (!values) {
        throw new Error(
          "Embedding API returned an entry with no values."
        );
      }

      results.push(
        values
      );
    }
  }

  return results;
}

// =========================================================
// EMBED SINGLE TEXT
// =========================================================
//
// Convenience wrapper for the common single-query case
// (e.g. embedding a user's live question at retrieval time).
//

export async function embedText(
  text: string,
  taskType: EmbeddingTaskType
): Promise<number[]> {
  const [
    embedding,
  ] = await embedTexts(
    [text],
    taskType
  );

  if (!embedding) {
    throw new Error(
      "Embedding API returned no result."
    );
  }

  return embedding;
}

// =========================================================
// COSINE SIMILARITY
// =========================================================

export function cosineSimilarity(
  a: number[],
  b: number[]
): number {
  if (
    a.length !== b.length
  ) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (
    let i = 0;
    i < a.length;
    i++
  ) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  if (
    normA === 0 ||
    normB === 0
  ) {
    return 0;
  }

  return (
    dot /
    (Math.sqrt(normA) *
      Math.sqrt(normB))
  );
}