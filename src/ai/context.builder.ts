import { prisma } from "../database/prisma";

import {
  getRecentMessages,
} from "../conversations/message.service";

import {
  retrieveKnowledgeHybrid,
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

  let knowledge: AIContext["knowledge"] = [];

  if (user.facultyId) {
    console.log(
      "========================================"
    );

    console.log(
      "[CONTEXT] Starting knowledge retrieval..."
    );

    console.log(
      `[CONTEXT] Faculty ID: ${user.facultyId}`
    );

    console.log(
      `[CONTEXT] Department ID: ${
        user.departmentId ?? "Not specified"
      }`
    );

    console.log(
      `[CONTEXT] Level: ${
        user.level ?? "Not specified"
      }`
    );

    console.log(
      `[CONTEXT] Query: ${currentMessage}`
    );

    try {
      knowledge =
        await retrieveKnowledgeHybrid({
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

      console.log(
        `[CONTEXT] Retrieved ${knowledge.length} knowledge chunk(s).`
      );

      for (
        let index = 0;
        index < knowledge.length;
        index++
      ) {
        const item =
          knowledge[index];

        console.log(
          `[CONTEXT] Knowledge ${index + 1}: ${item.source.title} | score=${item.score}`
        );
      }
    } catch (retrievalError) {
      /**
       * Knowledge retrieval should not prevent the AI
       * from responding completely.
       *
       * If retrieval fails, we continue with an empty
       * knowledge context.
       */

      console.error(
        "[CONTEXT] Knowledge retrieval failed:",
        retrievalError
      );

      knowledge = [];
    }

    console.log(
      "========================================"
    );
  } else {
    console.log(
      "[CONTEXT] User has no faculty assigned. Skipping knowledge retrieval."
    );
  }

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
        user.faculty?.name ?? null,

      department:
        user.department?.name ?? null,

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
    // RETRIEVED KNOWLEDGE
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