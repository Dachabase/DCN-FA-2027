import "dotenv/config";

import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error(
    "GEMINI_API_KEY is not configured in your .env file."
  );
}

const primaryModel =
  process.env.GEMINI_PRIMARY_MODEL?.trim() ||
  process.env.GEMINI_MODEL?.trim() ||
  "gemini-2.5-flash-lite";

const configuredFallbackModels =
  process.env.GEMINI_FALLBACK_MODEL?.trim() ||
  process.env.GEMINI_FALLBACK_MODELS?.trim() ||
  "gemini-2.5-flash";

const fallbackModels = configuredFallbackModels
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);

const models = Array.from(
  new Set([primaryModel, ...fallbackModels])
);

const ai = new GoogleGenAI({
  apiKey,
});

function timestamp(): string {
  return new Date().toISOString();
}

function log(message: string): void {
  console.log(`[${timestamp()}] [DIAGNOSTIC] ${message}`);
}

function logSeparator(): void {
  console.log(
    `[${timestamp()}] [DIAGNOSTIC] ========================================`
  );
}

async function testModel(model: string): Promise<void> {
  logSeparator();

  log(`Testing model: ${model}`);
  log("Sending minimal Gemini request...");

  const start = Date.now();

  try {
    const response = await ai.models.generateContent({
      model,
      contents: "Reply with exactly: Gemini connection successful.",
    });

    const duration = Date.now() - start;

    const text = response.text?.trim();

    log(`Request completed in ${duration}ms.`);

    if (!text) {
      log("ERROR: Gemini returned an empty response.");
      return;
    }

    log(`Response received: ${text}`);
    log(`Model ${model} is WORKING.`);
  } catch (error) {
    const duration = Date.now() - start;

    log(`Request failed after ${duration}ms.`);
    log(`Model: ${model}`);

    if (error instanceof Error) {
      log(`Error name: ${error.name}`);
      log(`Error message: ${error.message}`);
      log(`Error stack:`);
      console.error(error);
    } else {
      log("Unknown error:");
      console.error(error);
    }
  }
}

async function testContextualRequest(model: string): Promise<void> {
  logSeparator();

  log(`Testing contextual request with: ${model}`);

  const conversation = [
    {
      role: "user",
      content: "Hello",
    },
    {
      role: "assistant",
      content:
        "Hello David! How can I help you with your studies?",
    },
    {
      role: "user",
      content:
        "I'm finding JavaScript difficult, especially functions and arrays.",
    },
    {
      role: "assistant",
      content:
        "That's completely normal when you're starting out. We can break functions and arrays down step by step.",
    },
  ];

  const systemInstruction = `
You are the University of Ibadan Computing Freshers Companion.

You are a personalised study buddy for Computing students.

The student is:

Name: David
Faculty: Computing
Department: Software Engineering
Level: 100

Known memories:

- Student finds JavaScript challenging, particularly functions and arrays.
- Student wants to become a skilled software engineer.

Be friendly, practical and encouraging.

Do not invent official university information.
Explain concepts progressively.
Use the student's profile when relevant.
`;

  const currentMessage = "Hey, can you help me improve my JavaScript?";

  const conversationText = conversation
    .map(
      (message) =>
        `${message.role.toUpperCase()}: ${message.content}`
    )
    .join("\n\n");

  const contents = `
PREVIOUS CONVERSATION:

${conversationText}

CURRENT STUDENT MESSAGE:

${currentMessage}
`;

  log(`Context characters: ${contents.length}`);
  log(`System instruction characters: ${systemInstruction.length}`);

  const start = Date.now();

  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
      },
    });

    const duration = Date.now() - start;

    const text = response.text?.trim();

    log(`Contextual request completed in ${duration}ms.`);

    if (!text) {
      log("ERROR: Contextual request returned an empty response.");
      return;
    }

    log(`Response length: ${text.length} characters.`);
    log("Contextual Gemini request is WORKING.");
    console.log("\n--- GEMINI RESPONSE ---\n");
    console.log(text);
    console.log("\n--- END RESPONSE ---\n");
  } catch (error) {
    const duration = Date.now() - start;

    log(`Contextual request failed after ${duration}ms.`);

    if (error instanceof Error) {
      log(`Error name: ${error.name}`);
      log(`Error message: ${error.message}`);
      console.error(error);
    } else {
      console.error(error);
    }
  }
}

async function main(): Promise<void> {
  logSeparator();
  log("GEMINI CONNECTIVITY DIAGNOSTIC");
  logSeparator();

  log(`Primary model: ${primaryModel}`);
  log(`Fallback models: ${fallbackModels.join(" → ")}`);
  log(`Total models: ${models.length}`);

  console.log("");

  // ---------------------------------------------------------
  // TEST 1: BASIC REQUEST
  // ---------------------------------------------------------

  for (const model of models) {
    await testModel(model);
  }

  // ---------------------------------------------------------
  // TEST 2: CONTEXTUAL REQUEST
  // ---------------------------------------------------------

  for (const model of models) {
    await testContextualRequest(model);
  }

  // ---------------------------------------------------------
  // COMPLETE
  // ---------------------------------------------------------

  logSeparator();
  log("Gemini diagnostic completed.");
  logSeparator();
}

main().catch((error) => {
  console.error(
    `[${timestamp()}] [DIAGNOSTIC] Fatal diagnostic error:`
  );

  console.error(error);

  process.exit(1);
});