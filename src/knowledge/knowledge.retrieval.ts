import { prisma } from "../database/prisma";

import {
  embedText,
  cosineSimilarity,
} from "./embedding.service";

import type {
  KnowledgeAuthority,
} from "../generated/prisma/client";

// =========================================================
// CONFIGURATION
// =========================================================

const DEFAULT_LIMIT = 6;

const MAX_LIMIT = 12;

// =========================================================
// TYPES
// =========================================================

export interface KnowledgeRetrievalOptions {
  query: string;

  facultyId: string;

  departmentId?: string | null;

  level?: number | null;

  limit?: number;
}

export interface RetrievedKnowledge {
  chunkId: string;

  content: string;

  heading: string | null;

  pageNumber: number | null;

  slideNumber: number | null;

  source: {
    id: string;

    title: string;

    description: string | null;

    type: string;

    authority: KnowledgeAuthority;

    fileName: string | null;

    sourceUrl: string | null;

    departmentId: string | null;

    courseCode: string | null;

    courseName: string | null;

    level: number | null;

    version: string | null;

    publishedAt: Date | null;

    expiresAt: Date | null;
  };

  score: number;
}

// =========================================================
// HELPERS
// =========================================================

function normalizeQuery(
  query: string
): string {
  return query
    .replace(/\s+/g, " ")
    .trim();
}

function clampLimit(
  limit?: number
): number {
  if (
    !limit ||
    !Number.isFinite(limit)
  ) {
    return DEFAULT_LIMIT;
  }

  return Math.min(
    Math.max(
      Math.floor(limit),
      1
    ),
    MAX_LIMIT
  );
}

// =========================================================
// KNOWLEDGE RETRIEVAL
// =========================================================
//
// Performs PostgreSQL full-text search.
//
// Retrieval scope:
//
// 1. Faculty must match.
// 2. Knowledge source must be ACTIVE.
// 3. Expired sources are excluded.
// 4. Faculty-wide knowledge (departmentId = NULL)
//    is available to everyone in the faculty.
// 5. Department-specific knowledge is available when
//    the student's department matches.
// 6. General knowledge (level = NULL) is available
//    at every level.
// 7. Level-specific knowledge is available when the
//    student's level matches.
//
// =========================================================

export async function retrieveKnowledge(
  options: KnowledgeRetrievalOptions
): Promise<RetrievedKnowledge[]> {
  // -------------------------------------------------------
  // NORMALIZE INPUT
  // -------------------------------------------------------

  const query =
    normalizeQuery(
      options.query
    );

  if (!query) {
    return [];
  }

  if (!options.facultyId) {
    throw new Error(
      "facultyId is required for knowledge retrieval."
    );
  }

  const limit =
    clampLimit(
      options.limit
    );

  // -------------------------------------------------------
  // BUILD SQL PARAMETERS
  // -------------------------------------------------------
  //
  // We deliberately build the parameter list dynamically
  // so that the SQL placeholder numbers always match the
  // parameters actually being used.
  //
  // This avoids PostgreSQL errors such as:
  //
  // "could not determine data type of parameter $2"
  //
  // -------------------------------------------------------

  const parameters: unknown[] = [];

  // $1 = faculty ID
  parameters.push(
    options.facultyId
  );

  let parameterIndex = 2;

  // -------------------------------------------------------
  // OPTIONAL DEPARTMENT FILTER
  // -------------------------------------------------------

  let departmentFilter = "";

  if (
    options.departmentId
  ) {
    const departmentParameter =
      parameterIndex++;

    departmentFilter = `
      AND (
        ks."departmentId" IS NULL
        OR ks."departmentId" = $${departmentParameter}::text
      )
    `;

    parameters.push(
      options.departmentId
    );
  }

  // -------------------------------------------------------
  // OPTIONAL LEVEL FILTER
  // -------------------------------------------------------

  let levelFilter = "";

  if (
    options.level !== null &&
    options.level !== undefined
  ) {
    const levelParameter =
      parameterIndex++;

    levelFilter = `
      AND (
        ks."level" IS NULL
        OR ks."level" = $${levelParameter}::integer
      )
    `;

    parameters.push(
      options.level
    );
  }

  // -------------------------------------------------------
  // SEARCH QUERY PARAMETER
  // -------------------------------------------------------

  const queryParameter =
    parameterIndex++;

  parameters.push(
    query
  );

  // -------------------------------------------------------
  // LIMIT PARAMETER
  // -------------------------------------------------------

  const limitParameter =
    parameterIndex++;

  parameters.push(
    limit
  );

  // =======================================================
  // FULL-TEXT SEARCH
  // =======================================================

  const rows =
    await prisma.$queryRawUnsafe<
      Array<{
        chunkId: string;

        content: string;

        heading: string | null;

        pageNumber: number | null;

        slideNumber: number | null;

        sourceId: string;

        title: string;

        description: string | null;

        type: string;

        authority: KnowledgeAuthority;

        fileName: string | null;

        sourceUrl: string | null;

        departmentId: string | null;

        courseCode: string | null;

        courseName: string | null;

        level: number | null;

        version: string | null;

        publishedAt: Date | null;

        expiresAt: Date | null;

        searchScore: number;
      }>
    >(
      `
      SELECT

        kc."id" AS "chunkId",

        kc."content" AS "content",

        kc."heading" AS "heading",

        kc."pageNumber" AS "pageNumber",

        kc."slideNumber" AS "slideNumber",

        ks."id" AS "sourceId",

        ks."title" AS "title",

        ks."description" AS "description",

        ks."type" AS "type",

        ks."authority" AS "authority",

        ks."fileName" AS "fileName",

        ks."sourceUrl" AS "sourceUrl",

        ks."departmentId" AS "departmentId",

        ks."courseCode" AS "courseCode",

        ks."courseName" AS "courseName",

        ks."level" AS "level",

        ks."version" AS "version",

        ks."publishedAt" AS "publishedAt",

        ks."expiresAt" AS "expiresAt",

        ts_rank(
          to_tsvector(
            'english',
            COALESCE(
              kc."content",
              ''
            )
            || ' '
            || COALESCE(
              kc."heading",
              ''
            )
            || ' '
            || COALESCE(
              ks."title",
              ''
            )
            || ' '
            || COALESCE(
              ks."courseCode",
              ''
            )
            || ' '
            || COALESCE(
              ks."courseName",
              ''
            )
          ),
          plainto_tsquery(
            'english',
            $${queryParameter}::text
          )
        ) AS "searchScore"

      FROM "KnowledgeChunk" kc

      INNER JOIN "KnowledgeSource" ks
        ON ks."id" = kc."sourceId"

      WHERE

        -- -------------------------------------------------
        -- FACULTY SCOPE
        -- -------------------------------------------------

        ks."facultyId" =
          $1::text

        -- -------------------------------------------------
        -- ACTIVE KNOWLEDGE ONLY
        -- -------------------------------------------------

        AND ks."status" = 'ACTIVE'

        -- -------------------------------------------------
        -- EXCLUDE EXPIRED KNOWLEDGE
        -- -------------------------------------------------

        AND (
          ks."expiresAt" IS NULL
          OR ks."expiresAt" > NOW()
        )

        ${departmentFilter}

        ${levelFilter}

        -- -------------------------------------------------
        -- FULL-TEXT MATCH
        -- -------------------------------------------------

        AND to_tsvector(
          'english',
          COALESCE(
            kc."content",
            ''
          )
          || ' '
          || COALESCE(
            kc."heading",
            ''
          )
          || ' '
          || COALESCE(
            ks."title",
            ''
          )
          || ' '
          || COALESCE(
            ks."courseCode",
            ''
          )
          || ' '
          || COALESCE(
            ks."courseName",
            ''
          )
        )
        @@ plainto_tsquery(
          'english',
          $${queryParameter}::text
        )

      -- ---------------------------------------------------
      -- RESULT ORDERING
      -- ---------------------------------------------------

      ORDER BY

        CASE ks."authority"

          WHEN 'OFFICIAL'
            THEN 5

          WHEN 'FACULTY'
            THEN 4

          WHEN 'DEPARTMENT'
            THEN 3

          WHEN 'COURSE'
            THEN 2

          WHEN 'GENERAL'
            THEN 1

          ELSE 0

        END DESC,

        "searchScore" DESC,

        ks."publishedAt"
          DESC NULLS LAST,

        kc."chunkIndex"
          ASC

      -- ---------------------------------------------------
      -- RESULT LIMIT
      -- ---------------------------------------------------

      LIMIT $${limitParameter}::integer
      `,
      ...parameters
    );

  // =======================================================
  // FORMAT RESULTS
  // =======================================================

  return rows.map(
    (row) => ({
      chunkId:
        row.chunkId,

      content:
        row.content,

      heading:
        row.heading,

      pageNumber:
        row.pageNumber,

      slideNumber:
        row.slideNumber,

      source: {
        id:
          row.sourceId,

        title:
          row.title,

        description:
          row.description,

        type:
          row.type,

        authority:
          row.authority,

        fileName:
          row.fileName,

        sourceUrl:
          row.sourceUrl,

        departmentId:
          row.departmentId,

        courseCode:
          row.courseCode,

        courseName:
          row.courseName,

        level:
          row.level,

        version:
          row.version,

        publishedAt:
          row.publishedAt,

        expiresAt:
          row.expiresAt,
      },

      score:
        Number(
          row.searchScore
        ),
    })
  );
}

// =========================================================
// RETRIEVE FACULTY KNOWLEDGE
// =========================================================
//
// Convenience function for situations where only the
// faculty scope is known.
//

export async function retrieveFacultyKnowledge(
  facultyId: string,
  query: string,
  limit = DEFAULT_LIMIT
): Promise<RetrievedKnowledge[]> {
  return retrieveKnowledge({
    facultyId,

    query,

    limit,
  });
}

// =========================================================
// RETRIEVE DEPARTMENT KNOWLEDGE
// =========================================================
//
// Convenience function for students whose department is
// already known.
//

export async function retrieveDepartmentKnowledge(
  facultyId: string,
  departmentId: string,
  query: string,
  level?: number | null,
  limit = DEFAULT_LIMIT
): Promise<RetrievedKnowledge[]> {
  return retrieveKnowledge({
    facultyId,

    departmentId,

    level,

    query,

    limit,
  });
}

// =========================================================
// AUTHORITY WEIGHT
// =========================================================
//
// Mirrors the CASE ordering in retrieveKnowledge()'s SQL so
// both retrieval paths (and the hybrid merge) treat source
// authority consistently.
//

const AUTHORITY_WEIGHT: Record<
  string,
  number
> = {
  OFFICIAL: 5,
  FACULTY: 4,
  DEPARTMENT: 3,
  COURSE: 2,
  GENERAL: 1,
};

function authorityWeight(
  authority: string
): number {
  return (
    AUTHORITY_WEIGHT[
      authority
    ] ?? 0
  );
}

// =========================================================
// SEMANTIC RETRIEVAL
// =========================================================
//
// Brute-force cosine similarity over embedded chunks in
// application code (see the embedding column's comment in
// schema.prisma for why this isn't pgvector). Two-phase:
// first fetch only (id, embedding) for scoring — much
// cheaper than pulling full chunk/source content for every
// candidate — then fetch full details only for the winners.
//

export async function retrieveKnowledgeSemantic(
  options: KnowledgeRetrievalOptions
): Promise<RetrievedKnowledge[]> {
  const query =
    normalizeQuery(
      options.query
    );

  if (!query) {
    return [];
  }

  if (!options.facultyId) {
    throw new Error(
      "facultyId is required for knowledge retrieval."
    );
  }

  const limit =
    clampLimit(
      options.limit
    );

  let queryEmbedding: number[];

  try {
    queryEmbedding =
      await embedText(
        query,
        "RETRIEVAL_QUERY"
      );
  } catch (embeddingError) {
    console.error(
      "[RETRIEVAL] Failed to embed query, semantic search unavailable for this request:",
      embeddingError instanceof
        Error
        ? embeddingError.message
        : embeddingError
    );

    return [];
  }

  const scopeFilters: Array<
    Record<string, unknown>
  > = [
    {
      OR: [
        {
          expiresAt: null,
        },
        {
          expiresAt: {
            gt: new Date(),
          },
        },
      ],
    },
  ];

  if (
    options.departmentId
  ) {
    scopeFilters.push({
      OR: [
        {
          departmentId: null,
        },
        {
          departmentId:
            options.departmentId,
        },
      ],
    });
  }

  if (
    options.level !== null &&
    options.level !== undefined
  ) {
    scopeFilters.push({
      OR: [
        { level: null },
        {
          level:
            options.level,
        },
      ],
    });
  }

  const candidates =
    await prisma.knowledgeChunk.findMany(
      {
        where: {
          embedding: {
            isEmpty: false,
          },
          source: {
            facultyId:
              options.facultyId,
            status:
              "ACTIVE",
            AND:
              scopeFilters,
          },
        },
        select: {
          id: true,
          embedding: true,
        },
      }
    );

  if (
    candidates.length === 0
  ) {
    return [];
  }

  const ranked = candidates
    .map((c) => ({
      id: c.id,
      score:
        cosineSimilarity(
          queryEmbedding,
          c.embedding
        ),
    }))
    .sort(
      (a, b) =>
        b.score - a.score
    )
    .slice(0, limit);

  const scoreById = new Map(
    ranked.map((r) => [
      r.id,
      r.score,
    ])
  );

  const details =
    await prisma.knowledgeChunk.findMany(
      {
        where: {
          id: {
            in: ranked.map(
              (r) => r.id
            ),
          },
        },
        include: {
          source: true,
        },
      }
    );

  return details
    .map(
      (chunk): RetrievedKnowledge => ({
        chunkId: chunk.id,

        content: chunk.content,

        heading:
          chunk.heading,

        pageNumber:
          chunk.pageNumber,

        slideNumber:
          chunk.slideNumber,

        source: {
          id: chunk.source.id,

          title:
            chunk.source
              .title,

          description:
            chunk.source
              .description,

          type: chunk.source
            .type,

          authority:
            chunk.source
              .authority,

          fileName:
            chunk.source
              .fileName,

          sourceUrl:
            chunk.source
              .sourceUrl,

          departmentId:
            chunk.source
              .departmentId,

          courseCode:
            chunk.source
              .courseCode,

          courseName:
            chunk.source
              .courseName,

          level:
            chunk.source
              .level,

          version:
            chunk.source
              .version,

          publishedAt:
            chunk.source
              .publishedAt,

          expiresAt:
            chunk.source
              .expiresAt,
        },

        score:
          scoreById.get(
            chunk.id
          ) ?? 0,
      })
    )
    .sort(
      (a, b) =>
        b.score - a.score
    );
}

// =========================================================
// HYBRID RETRIEVAL
// =========================================================
//
// Runs keyword (full-text) and semantic retrieval in
// parallel, then merges results by chunkId. A chunk found by
// both methods is strictly more likely to be relevant than
// one found by only one — this rewards that overlap while
// still surfacing chunks each method finds alone.
//
// Both raw score types are on different, not-directly-
// comparable scales (ts_rank is small and unbounded; cosine
// similarity is roughly 0-1), so each is normalized against
// the max score within its own result set before combining.
//
// Authority tier remains the primary sort key, same as
// keyword-only retrieval — a hybrid score bump should not
// let a low-authority source outrank an official one.
//

const HYBRID_KEYWORD_WEIGHT = 0.5;
const HYBRID_SEMANTIC_WEIGHT = 0.5;

export async function retrieveKnowledgeHybrid(
  options: KnowledgeRetrievalOptions
): Promise<RetrievedKnowledge[]> {
  const limit =
    clampLimit(
      options.limit
    );

  // Fetch a wider pool from each method than the final
  // limit, so the merge has enough to work with.
  const poolLimit = Math.min(
    limit * 2,
    MAX_LIMIT
  );

  const [
    keywordResults,
    semanticResults,
  ] = await Promise.all([
    retrieveKnowledge({
      ...options,
      limit: poolLimit,
    }),
    retrieveKnowledgeSemantic(
      {
        ...options,
        limit: poolLimit,
      }
    ),
  ]);

  const maxKeywordScore =
    Math.max(
      ...keywordResults.map(
        (r) => r.score
      ),
      0
    ) || 1;

  const maxSemanticScore =
    Math.max(
      ...semanticResults.map(
        (r) => r.score
      ),
      0
    ) || 1;

  const merged = new Map<
    string,
    {
      item: RetrievedKnowledge;
      hybridScore: number;
    }
  >();

  for (const result of keywordResults) {
    const normalized =
      result.score /
      maxKeywordScore;

    merged.set(
      result.chunkId,
      {
        item: result,
        hybridScore:
          normalized *
          HYBRID_KEYWORD_WEIGHT,
      }
    );
  }

  for (const result of semanticResults) {
    const normalized =
      Math.max(
        result.score,
        0
      ) / maxSemanticScore;

    const existing =
      merged.get(
        result.chunkId
      );

    if (existing) {
      existing.hybridScore +=
        normalized *
        HYBRID_SEMANTIC_WEIGHT;
    } else {
      merged.set(
        result.chunkId,
        {
          item: result,
          hybridScore:
            normalized *
            HYBRID_SEMANTIC_WEIGHT,
        }
      );
    }
  }

  return [...merged.values()]
    .sort((a, b) => {
      const authorityDiff =
        authorityWeight(
          b.item.source
            .authority
        ) -
        authorityWeight(
          a.item.source
            .authority
        );

      if (
        authorityDiff !== 0
      ) {
        return authorityDiff;
      }

      return (
        b.hybridScore -
        a.hybridScore
      );
    })
    .slice(0, limit)
    .map((entry) => ({
      ...entry.item,
      score:
        entry.hybridScore,
    }));
}