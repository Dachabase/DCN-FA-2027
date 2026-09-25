import { prisma } from "../database/prisma";

import {
  getRecentMessages,
} from "../conversations/message.service";

import {
  retrieveKnowledge,
  type RetrievedKnowledge,
} from "../knowledge/knowledge.retrieval";

import type {
  AIContext,
} from "./ai.provider";

// ---------------------------------------------------------
// CONTEXT CONFIGURATION
// ---------------------------------------------------------

const RECENT_MESSAGE_LIMIT = 20;

const MEMORY_LIMIT = 20;

const KNOWLEDGE_LIMIT = 6;

// ---------------------------------------------------------
// BUILD AI CONTEXT
// ---------------------------------------------------------

export async function buildAIContext(
  userId: string,
  conversationId: string,
  currentMessage: string
): Promise<AIContext> {
  // -------------------------------------------------------
  // LOAD USER
  // -------------------------------------------------------

  const user =
    await prisma.user.findUnique({
      where: {
        id: userId,
      },

      include: {
        faculty: true,

        department: true,

        memories: {
          orderBy: [
            {
              importance: "desc",
            },

            {
              updatedAt: "desc",
            },
          ],

          take: MEMORY_LIMIT,
        },
      },
    });

  if (!user) {
    throw new Error(
      `User ${userId} not found`
    );
  }

  // -------------------------------------------------------
  // LOAD CONVERSATION HISTORY
  // -------------------------------------------------------

  /**
   * IMPORTANT:
   *
   * We intentionally load the conversation history
   * BEFORE saving the current user message.
   *
   * Therefore:
   *
   * messages.length === 0
   *
   * means this is genuinely the first message in
   * the conversation.
   *
   * The current message is supplied separately through
   * `currentMessage`.
   */

  const messages =
    await getRecentMessages(
      conversationId,
      RECENT_MESSAGE_LIMIT
    );

  // -------------------------------------------------------
  // DETERMINE WHETHER THIS IS THE FIRST MESSAGE
  // -------------------------------------------------------

  const isFirstMessage =
    messages.length === 0;

  // -------------------------------------------------------
  // RETRIEVE RELEVANT KNOWLEDGE
  // -------------------------------------------------------

  /**
   * Knowledge retrieval is deliberately performed using
   * the student's faculty, department and level.
   *
   * We do NOT load the entire faculty knowledge base.
   *
   * Only knowledge relevant to the student's current
   * question is retrieved and placed into AI context.
   */

  let knowledge: RetrievedKnowledge[] = [];

  if (
    user.facultyId
  ) {
    knowledge =
      await retrieveKnowledge({
        query:
          currentMessage,

        facultyId:
          user.facultyId,

        departmentId:
          user.departmentId,

        level:
          user.level,

        limit:
          KNOWLEDGE_LIMIT,
      });
  }

  // -------------------------------------------------------
  // LOG KNOWLEDGE RETRIEVAL
  // -------------------------------------------------------

  console.log(
    "========================================"
  );

  console.log(
    "[AI CONTEXT] Knowledge retrieval"
  );

  console.log(
    `[AI CONTEXT] Query: ${currentMessage}`
  );

  console.log(
    `[AI CONTEXT] Faculty ID: ${
      user.facultyId ?? "Not specified"
    }`
  );

  console.log(
    `[AI CONTEXT] Department ID: ${
      user.departmentId ?? "Not specified"
    }`
  );

  console.log(
    `[AI CONTEXT] Level: ${
      user.level ?? "Not specified"
    }`
  );

  console.log(
    `[AI CONTEXT] Retrieved ${
      knowledge.length
    } knowledge chunk(s).`
  );

  if (
    knowledge.length > 0
  ) {
    knowledge.forEach(
      (
        item,
        index
      ) => {
        console.log(
          `[AI CONTEXT] Knowledge ${
            index + 1
          }: ${item.source.title}`
        );
      }
    );
  }

  console.log(
    "========================================"
  );

  // -------------------------------------------------------
  // BUILD CONTEXT
  // -------------------------------------------------------

  return {
    user: {
      firstName:
        user.firstName,

      lastName:
        user.lastName,

      username:
        user.username,

      faculty:
        user.faculty?.name ??
        null,

      department:
        user.department?.name ??
        null,

      level:
        user.level,
    },

    // -----------------------------------------------------
    // STUDENT MEMORIES
    // -----------------------------------------------------

    memories:
      user.memories.map(
        (memory) => ({
          type:
            memory.type,

          content:
            memory.content,

          importance:
            memory.importance,

          confidence:
            memory.confidence,
        })
      ),

    // -----------------------------------------------------
    // RELEVANT KNOWLEDGE
    // -----------------------------------------------------

    knowledge,

    // -----------------------------------------------------
    // RECENT CONVERSATION
    // -----------------------------------------------------

    messages:
      messages.map(
        (message) => ({
          role:
            message.role === "USER"
              ? "user"
              : "assistant",

          content:
            message.content,
        })
      ),

    // -----------------------------------------------------
    // CURRENT MESSAGE
    // -----------------------------------------------------

    currentMessage,

    // -----------------------------------------------------
    // FIRST MESSAGE FLAG
    // -----------------------------------------------------

    isFirstMessage,
  };
}