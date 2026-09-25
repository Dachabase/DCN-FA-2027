import { prisma } from "../database/prisma";

import type {
  KnowledgeSourceType,
  KnowledgeAuthority,
  KnowledgeSourceStatus,
} from "../generated/prisma/client";

// =========================================================
// CREATE KNOWLEDGE SOURCE
// =========================================================

export async function createKnowledgeSource(
  params: {
    title: string;
    description?: string;

    type: KnowledgeSourceType;

    fileName?: string;
    sourceUrl?: string;
    checksum?: string;

    facultyId: string;
    departmentId?: string;

    courseCode?: string;
    courseName?: string;
    level?: number;

    authority?: KnowledgeAuthority;

    status?: KnowledgeSourceStatus;

    version?: string;

    publishedAt?: Date;
    expiresAt?: Date;

    metadata?: unknown;
  }
) {
  return prisma.knowledgeSource.create({
    data: {
      title:
        params.title,

      description:
        params.description,

      type:
        params.type,

      fileName:
        params.fileName,

      sourceUrl:
        params.sourceUrl,

      checksum:
        params.checksum,

      facultyId:
        params.facultyId,

      departmentId:
        params.departmentId,

      courseCode:
        params.courseCode,

      courseName:
        params.courseName,

      level:
        params.level,

      authority:
        params.authority ??
        "GENERAL",

      status:
        params.status ??
        "ACTIVE",

      version:
        params.version,

      publishedAt:
        params.publishedAt,

      expiresAt:
        params.expiresAt,

      metadata:
        params.metadata as any,
    },
  });
}

// =========================================================
// CREATE KNOWLEDGE CHUNKS
// =========================================================

export async function createKnowledgeChunks(
  sourceId: string,
  chunks: Array<{
    content: string;
    chunkIndex: number;
    heading?: string;
    pageNumber?: number;
    slideNumber?: number;
    metadata?: unknown;
  }>
) {
  if (
    chunks.length === 0
  ) {
    return [];
  }

  await prisma.knowledgeChunk.createMany({
    data: chunks.map(
      (chunk) => ({
        sourceId,

        chunkIndex:
          chunk.chunkIndex,

        content:
          chunk.content,

        heading:
          chunk.heading,

        pageNumber:
          chunk.pageNumber,

        slideNumber:
          chunk.slideNumber,

        metadata:
          chunk.metadata as any,
      })
    ),
  });

  return prisma.knowledgeChunk.findMany({
    where: {
      sourceId,
    },

    orderBy: {
      chunkIndex: "asc",
    },
  });
}

// =========================================================
// CREATE KNOWLEDGE SOURCE WITH CHUNKS (ATOMIC)
// =========================================================
//
// Wraps source creation and chunk creation in a single
// transaction. Without this, a chunk-insert failure (e.g.
// a bad byte sequence Postgres rejects) leaves an orphan
// KnowledgeSource row with a checksum but zero chunks —
// which then gets silently treated as "already ingested"
// by the batch script's dedup check on every future run,
// permanently hiding that file from ever being retried.
//

export async function createKnowledgeSourceWithChunks(
  sourceParams: Parameters<
    typeof createKnowledgeSource
  >[0] & {
    contentChecksum?: string;
  },
  chunks: Array<{
    content: string;
    chunkIndex: number;
    heading?: string;
    pageNumber?: number;
    slideNumber?: number;
    metadata?: unknown;
    embedding?: number[];
  }>
) {
  return prisma.$transaction(
    async (tx) => {
      const source =
        await tx.knowledgeSource.create({
          data: {
            title:
              sourceParams.title,
            description:
              sourceParams.description,
            type:
              sourceParams.type,
            fileName:
              sourceParams.fileName,
            sourceUrl:
              sourceParams.sourceUrl,
            checksum:
              sourceParams.checksum,
            contentChecksum:
              sourceParams.contentChecksum,
            facultyId:
              sourceParams.facultyId,
            departmentId:
              sourceParams.departmentId,
            courseCode:
              sourceParams.courseCode,
            courseName:
              sourceParams.courseName,
            level:
              sourceParams.level,
            authority:
              sourceParams.authority ??
              "GENERAL",
            status:
              sourceParams.status ??
              "ACTIVE",
            version:
              sourceParams.version,
            publishedAt:
              sourceParams.publishedAt,
            expiresAt:
              sourceParams.expiresAt,
            metadata:
              sourceParams.metadata as any,
          },
        });

      if (
        chunks.length > 0
      ) {
        await tx.knowledgeChunk.createMany({
          data: chunks.map(
            (chunk) => ({
              sourceId:
                source.id,
              chunkIndex:
                chunk.chunkIndex,
              content:
                chunk.content,
              heading:
                chunk.heading,
              pageNumber:
                chunk.pageNumber,
              slideNumber:
                chunk.slideNumber,
              metadata:
                chunk.metadata as any,
              embedding:
                chunk.embedding ??
                [],
            })
          ),
        });
      }

      const savedChunks =
        await tx.knowledgeChunk.findMany({
          where: {
            sourceId:
              source.id,
          },
          orderBy: {
            chunkIndex: "asc",
          },
        });

      return {
        source,
        chunks:
          savedChunks,
      };
    }
  );
}

// =========================================================
// FIND KNOWLEDGE SOURCE BY CHECKSUM
// =========================================================
//
// Used by batch ingestion to skip files that have already
// been ingested, so re-running the batch script is safe
// and does not create duplicate sources/chunks.
//

export async function findKnowledgeSourceByChecksum(
  facultyId: string,
  checksum: string
) {
  return prisma.knowledgeSource.findFirst({
    where: {
      facultyId,
      checksum,
    },
  });
}

// =========================================================
// FIND KNOWLEDGE SOURCE BY CONTENT CHECKSUM
// =========================================================
//
// Unlike findKnowledgeSourceByChecksum (raw file bytes),
// this catches files that differ at the byte level but
// contain identical extracted/chunked text — e.g. the same
// PDF re-exported with different metadata. Only matches
// ACTIVE sources, so an already-archived duplicate doesn't
// block re-ingestion of the canonical copy.
//

export async function findKnowledgeSourceByContentChecksum(
  facultyId: string,
  contentChecksum: string
) {
  return prisma.knowledgeSource.findFirst({
    where: {
      facultyId,
      contentChecksum,
      status: "ACTIVE",
    },
  });
}

// =========================================================
// GET KNOWLEDGE SOURCE
// =========================================================

export async function getKnowledgeSource(
  sourceId: string
) {
  return prisma.knowledgeSource.findUnique({
    where: {
      id: sourceId,
    },

    include: {
      faculty: true,
      department: true,

      chunks: {
        orderBy: {
          chunkIndex: "asc",
        },
      },
    },
  });
}