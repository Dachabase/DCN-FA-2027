import "dotenv/config";

import { prisma } from "../database/prisma";

import {
  buildAIContext,
} from "./ai.context";

import {
  generateAIResponseFromContext,
} from "./ai.service";

// =========================================================
// TEST CONFIGURATION
// =========================================================

const TEST_QUERY =
  "What do Software Engineering students study?";

// =========================================================
// MAIN
// =========================================================

async function main(): Promise<void> {
  console.log(
    "========================================"
  );

  console.log(
    "Starting AI context integration test..."
  );

  console.log(
    "========================================"
  );

  // -------------------------------------------------------
  // FIND TEST USER
  // -------------------------------------------------------

  const user =
    await prisma.user.findFirst({
      orderBy: {
        createdAt: "asc",
      },
    });

  if (!user) {
    throw new Error(
      "No user found in the database."
    );
  }

  console.log(
    `User found: ${user.firstName ?? "Unknown"}`
  );

  console.log(
    `User ID: ${user.id}`
  );

  // -------------------------------------------------------
  // FIND OR CREATE CONVERSATION
  // -------------------------------------------------------

  let conversation =
    await prisma.conversation.findFirst({
      where: {
        userId: user.id,
      },

      orderBy: {
        updatedAt: "desc",
      },
    });

  if (!conversation) {
    console.log(
      "No existing conversation found. Creating one..."
    );

    conversation =
      await prisma.conversation.create({
        data: {
          userId: user.id,
        },
      });

    console.log(
      `Conversation created: ${conversation.id}`
    );
  } else {
    console.log(
      `Conversation found: ${conversation.id}`
    );
  }

  // -------------------------------------------------------
  // BUILD AI CONTEXT
  // -------------------------------------------------------

  console.log(
    "========================================"
  );

  console.log(
    "Building AI context..."
  );

  console.log(
    `Current query: ${TEST_QUERY}`
  );

  const context =
    await buildAIContext(
      user.id,
      conversation.id,
      TEST_QUERY
    );

  console.log(
    "AI context successfully built."
  );

  // -------------------------------------------------------
  // DISPLAY USER PROFILE
  // -------------------------------------------------------

  console.log(
    "========================================"
  );

  console.log(
    "STUDENT PROFILE"
  );

  console.log(
    `Name: ${
      context.user.firstName ??
      "Not specified"
    }`
  );

  console.log(
    `Faculty: ${
      context.user.faculty ??
      "Not specified"
    }`
  );

  console.log(
    `Department: ${
      context.user.department ??
      "Not specified"
    }`
  );

  console.log(
    `Level: ${
      context.user.level ??
      "Not specified"
    }`
  );

  // -------------------------------------------------------
  // DISPLAY MEMORIES
  // -------------------------------------------------------

  console.log(
    "========================================"
  );

  console.log(
    `STUDENT MEMORIES (${context.memories.length})`
  );

  if (
    context.memories.length === 0
  ) {
    console.log(
      "No memories available."
    );
  } else {
    context.memories.forEach(
      (
        memory,
        index
      ) => {
        console.log(
          `${index + 1}. [${memory.type}] ${memory.content}`
        );

        console.log(
          `   Importance: ${memory.importance}`
        );

        console.log(
          `   Confidence: ${memory.confidence}`
        );
      }
    );
  }

  // -------------------------------------------------------
  // DISPLAY CONVERSATION
  // -------------------------------------------------------

  console.log(
    "========================================"
  );

  console.log(
    `CONVERSATION HISTORY (${context.messages.length} messages)`
  );

  if (
    context.messages.length === 0
  ) {
    console.log(
      "No previous conversation messages."
    );
  } else {
    context.messages.forEach(
      (
        message,
        index
      ) => {
        console.log(
          `${index + 1}. ${message.role}: ${message.content}`
        );
      }
    );
  }

  console.log(
    `First message: ${context.isFirstMessage}`
  );

  // -------------------------------------------------------
  // DISPLAY KNOWLEDGE
  // -------------------------------------------------------

  console.log(
    "========================================"
  );

  console.log(
    `RETRIEVED KNOWLEDGE (${context.knowledge.length} chunks)`
  );

  if (
    context.knowledge.length === 0
  ) {
    console.log(
      "WARNING: No knowledge was retrieved."
    );
  } else {
    context.knowledge.forEach(
      (
        knowledge,
        index
      ) => {
        console.log(
          `--- Knowledge ${index + 1} ---`
        );

        console.log(
          `Source: ${knowledge.source.title}`
        );

        console.log(
          `Authority: ${knowledge.source.authority}`
        );

        console.log(
          `Type: ${knowledge.source.type}`
        );

        console.log(
          `Score: ${knowledge.score}`
        );

        console.log(
          `Content:\n${knowledge.content}`
        );
      }
    );
  }

  // -------------------------------------------------------
  // CURRENT MESSAGE
  // -------------------------------------------------------

  console.log(
    "========================================"
  );

  console.log(
    "CURRENT MESSAGE"
  );

  console.log(
    context.currentMessage
  );

  // -------------------------------------------------------
  // SEND CONTEXT TO AI
  // -------------------------------------------------------

  console.log(
    "========================================"
  );

  console.log(
    "Sending complete context to Gemini..."
  );

  const response =
    await generateAIResponseFromContext(
      context
    );

  // -------------------------------------------------------
  // DISPLAY RESPONSE
  // -------------------------------------------------------

  console.log(
    "========================================"
  );

  console.log(
    "AI RESPONSE"
  );

  console.log(
    "========================================"
  );

  console.log(
    response
  );

  console.log(
    "========================================"
  );

  console.log(
    "AI context integration test completed successfully."
  );

  console.log(
    "========================================"
  );
}

// =========================================================
// RUN TEST
// =========================================================

main()
  .catch(
    (error) => {
      console.error(
        "AI context integration test failed:"
      );

      console.error(
        error
      );

      process.exitCode = 1;
    }
  )
  .finally(
    async () => {
      await prisma.$disconnect();
    }
  );