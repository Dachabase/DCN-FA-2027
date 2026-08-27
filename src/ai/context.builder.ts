import { prisma } from "../database/prisma";

import {
  getRecentMessages,
} from "../conversations/message.service";

import type {
  AIContext,
} from "./ai.provider";

// ---------------------------------------------------------
// CONTEXT CONFIGURATION
// ---------------------------------------------------------

const RECENT_MESSAGE_LIMIT = 20;

const MEMORY_LIMIT = 20;

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