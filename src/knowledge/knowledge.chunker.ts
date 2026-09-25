// =========================================================
// KNOWLEDGE CHUNKER
// =========================================================
//
// Splits extracted document text into manageable pieces
// before storing them as KnowledgeChunk records.
//
// The goal is NOT to blindly split every N characters.
//
// We first try to preserve paragraphs and sections, while
// keeping chunks within a reasonable size for later
// embedding/retrieval.
//

export interface KnowledgeChunkInput {
  content: string;
  chunkIndex: number;
  heading?: string;
  pageNumber?: number;
  slideNumber?: number;
}

const TARGET_CHUNK_SIZE = 1800;

const MAX_CHUNK_SIZE = 2400;

function normalizeWhitespace(
  text: string
): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitLargeParagraph(
  paragraph: string
): string[] {
  if (
    paragraph.length <= MAX_CHUNK_SIZE
  ) {
    return [paragraph];
  }

  const sentences =
    paragraph.split(
      /(?<=[.!?])\s+/
    );

  const chunks: string[] = [];

  let current = "";

  for (
    const sentence of sentences
  ) {
    if (!current) {
      current = sentence;
      continue;
    }

    const candidate =
      `${current} ${sentence}`;

    if (
      candidate.length <= MAX_CHUNK_SIZE
    ) {
      current = candidate;
    } else {
      chunks.push(current.trim());
      current = sentence;
    }
  }

  if (current.trim()) {
    chunks.push(
      current.trim()
    );
  }

  return chunks;
}

export function chunkText(
  text: string
): KnowledgeChunkInput[] {
  const normalized =
    normalizeWhitespace(text);

  if (!normalized) {
    return [];
  }

  const paragraphs =
    normalized
      .split(/\n\s*\n/)
      .map(
        (paragraph) =>
          paragraph.trim()
      )
      .filter(Boolean);

  const chunks: string[] = [];

  let current = "";

  for (
    const paragraph of paragraphs
  ) {
    const pieces =
      splitLargeParagraph(
        paragraph
      );

    for (
      const piece of pieces
    ) {
      if (!current) {
        current = piece;
        continue;
      }

      const candidate =
        `${current}\n\n${piece}`;

      if (
        candidate.length <=
        TARGET_CHUNK_SIZE
      ) {
        current = candidate;
      } else {
        chunks.push(
          current.trim()
        );

        current = piece;
      }
    }
  }

  if (current.trim()) {
    chunks.push(
      current.trim()
    );
  }

  return chunks.map(
    (content, index) => ({
      content,
      chunkIndex: index,
    })
  );
}