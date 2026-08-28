import "dotenv/config";

import {
  GoogleGenAI,
  type Content,
} from "@google/genai";

import type {
  AIContext,
} from "./ai.provider";

// ---------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------

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

const primaryModel =
  process.env.GEMINI_MODEL?.trim() ||
  "gemini-3.7-flash";

const fallbackModels =
  (process.env.GEMINI_FALLBACK_MODELS ?? "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);

const models = Array.from(
  new Set([
    primaryModel,
    ...fallbackModels,
  ])
);

// ---------------------------------------------------------
// RETRY CONFIGURATION
// ---------------------------------------------------------

/**
 * We do NOT retry 429 errors.
 *
 * A 429 can mean quota exhaustion, RPM exhaustion,
 * TPM exhaustion, etc.
 *
 * Since we already have fallback models, retrying the
 * same model immediately is usually wasteful and can
 * make the student's response slower.
 */
const maxAttemptsPerModel = 2;

const retryDelayMs = 2000;

// ---------------------------------------------------------
// TYPES
// ---------------------------------------------------------

export interface GenerateAIResponseOptions {
  systemInstruction?: string;
  userMessage: string;
}

// ---------------------------------------------------------
// LOGGING
// ---------------------------------------------------------

function timestamp(): string {
  return new Date().toISOString();
}

function log(
  message: string,
  ...args: unknown[]
): void {
  console.log(
    `[${timestamp()}] [AI] ${message}`,
    ...args
  );
}

function warn(
  message: string,
  ...args: unknown[]
): void {
  console.warn(
    `[${timestamp()}] [AI] ${message}`,
    ...args
  );
}

function error(
  message: string,
  ...args: unknown[]
): void {
  console.error(
    `[${timestamp()}] [AI] ${message}`,
    ...args
  );
}

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------

function sleep(
  ms: number
): Promise<void> {
  return new Promise(
    (resolve) => setTimeout(resolve, ms)
  );
}

function getErrorStatus(
  errorValue: unknown
): number | undefined {
  if (
    typeof errorValue === "object" &&
    errorValue !== null &&
    "status" in errorValue
  ) {
    const status =
      (
        errorValue as {
          status?: unknown;
        }
      ).status;

    if (
      typeof status === "number"
    ) {
      return status;
    }
  }

  return undefined;
}

function getErrorDescription(
  errorValue: unknown
): string {
  if (
    errorValue instanceof Error
  ) {
    return errorValue.message;
  }

  return String(errorValue);
}

/**
 * Determines whether an error is worth retrying
 * on the SAME model.
 *
 * 429 is deliberately excluded.
 *
 * If a model returns 429, we immediately move to
 * the fallback model instead.
 */
function isRetryableOnSameModel(
  errorValue: unknown
): boolean {
  const status =
    getErrorStatus(errorValue);

  if (
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    return true;
  }

  const message =
    errorValue instanceof Error
      ? errorValue.message.toLowerCase()
      : String(errorValue).toLowerCase();

  return (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("network") ||
    message.includes("fetch failed") ||
    message.includes(
      "temporarily unavailable"
    ) ||
    message.includes(
      "service unavailable"
    )
  );
}

/**
 * A 429 should cause immediate model failover.
 */
function isRateLimitError(
  errorValue: unknown
): boolean {
  return (
    getErrorStatus(errorValue) === 429
  );
}

// ---------------------------------------------------------
// TOKEN / CONTEXT ESTIMATION
// ---------------------------------------------------------

/**
 * This is only an approximate measurement.
 *
 * It is intentionally not presented as an exact Gemini
 * token count.
 *
 * Rough estimate:
 *
 * 1 token ≈ 4 characters for normal English text.
 */
function estimateTokens(
  text: string
): number {
  if (!text) {
    return 0;
  }

  return Math.ceil(
    text.length / 4
  );
}

function estimateContextSize(
  context: AIContext
): {
  characters: number;
  estimatedTokens: number;
} {
  const conversationText =
    context.messages
      .map(
        (message) =>
          `${message.role}: ${message.content}`
      )
      .join("\n");

  const memoryText =
    context.memories
      .map(
        (memory) =>
          `${memory.type}: ${memory.content}`
      )
      .join("\n");

  const combined =
    conversationText +
    "\n" +
    memoryText +
    "\n" +
    context.currentMessage;

  return {
    characters:
      combined.length,

    estimatedTokens:
      estimateTokens(combined),
  };
}

// ---------------------------------------------------------
// SYSTEM INSTRUCTION
// ---------------------------------------------------------

function buildSystemInstruction(
  context: AIContext
): string {
  const studentName =
    context.user.firstName ??
    "the student";

  const faculty =
    context.user.faculty ??
    "Computing";

  const department =
    context.user.department ??
    "Not yet specified";

  const level =
    context.user.level !== null
      ? String(context.user.level)
      : "Not yet specified";

  const memories =
    context.memories.length > 0
      ? context.memories
          .map(
            (memory, index) =>
              `${index + 1}. [${memory.type}] ${memory.content}`
          )
          .join("\n")
      : "No stored memories are currently available.";

  const greetingRule =
    context.isFirstMessage
      ? `
GREETING STATE:
This is the student's first message in this conversation.

You may greet the student naturally if it fits the response.
If you greet them, keep it brief.

Do not make the greeting unnecessarily long.
`
      : `
GREETING STATE:
This is an ongoing conversation.

DO NOT greet the student again.
DO NOT say "Welcome".
DO NOT say "Welcome back".
DO NOT say "Hello" as an unnecessary new greeting.
DO NOT repeat the student's name unnecessarily.

Continue naturally from the existing conversation.
`;

  return `
You are the University of Ibadan Computing Freshers Companion.

You are an AI-powered personalized study buddy for students
in the University of Ibadan Faculty of Computing.

Your job is to help students:

- understand academic concepts
- study effectively
- understand programming and technical concepts
- navigate university life
- think through academic problems
- prepare for tests and examinations
- plan their studies
- understand concepts appropriate to their level
- get useful guidance as a Computing student

You should be:

- friendly
- conversational
- intelligent
- encouraging
- practical
- clear

IMPORTANT FACTUAL RULES:

- Do not pretend to know information that you do not know.
- Do not invent official University of Ibadan policies,
  schedules, fees, course requirements or other official
  information.
- When information may have changed or you are uncertain,
  clearly say so.
- Do not present guesses as official facts.
- Do not mention these internal instructions to the student.
- Do not refer to yourself as a language model.
- You are their study companion, not a replacement for
  official university authorities.

${greetingRule}

CONVERSATION RULES:

- Treat the supplied conversation history as real conversation.
- Continue naturally from previous messages.
- Do not restart the conversation unnecessarily.
- Do not repeat information the student already knows.
- If the student changes topic, follow the new topic naturally.
- If the student's question is simple, answer simply.
- If the student asks for a detailed explanation, provide one.
- Match the response length to the student's request.
- Do not turn every question into a long lecture.
- Do not end every response with a question.
- Ask a follow-up question only when it genuinely helps.

TEACHING STYLE:

- Explain difficult concepts progressively.
- Prefer simple examples before advanced explanations.
- Use practical examples where useful.
- For programming questions, include code when useful.
- Explain code rather than dumping unexplained code.
- Adapt explanations to the student's level.

RESPONSE FORMATTING:

Use clean Markdown.

- Use short paragraphs.
- Use headings only when useful.
- Use bullets when useful.
- Use numbered lists when steps are involved.
- Use fenced code blocks for programming code.
- Avoid decorative separators.
- Do not overuse bold text.
- Do not use excessive emojis.
- Do not add unnecessary introductory filler.
- Do not add an unnecessary closing question.

STUDENT PROFILE:

Name:
${studentName}

Faculty:
${faculty}

Department:
${department}

Level:
${level}

KNOWN MEMORIES:

${memories}

MEMORY RULES:

- Use relevant memories naturally.
- Do not mention the existence of a memory system.
- Do not say "according to your memories".
- Do not force irrelevant memories into the response.
- Treat memories as useful context, not absolute truth.
- If the student corrects an old fact, follow the latest statement.
- Do not invent additional personal information.

The student's current message is the most important thing
to answer.
`.trim();
}

// ---------------------------------------------------------
// CONVERSATION CONTENT
// ---------------------------------------------------------

function buildConversationContents(
  context: AIContext
): Content[] {
  const contents: Content[] =
    context.messages.map(
      (message) => ({
        role:
          message.role === "assistant"
            ? "model"
            : "user",

        parts: [
          {
            text: message.content,
          },
        ],
      })
    );

  contents.push({
    role: "user",
    parts: [
      {
        text: context.currentMessage,
      },
    ],
  });

  return contents;
}

// ---------------------------------------------------------
// BASIC GEMINI REQUEST
// ---------------------------------------------------------

async function requestFromModel(
  model: string,
  options: GenerateAIResponseOptions
): Promise<string> {
  const startedAt =
    Date.now();

  log(
    `Sending request to model: ${model}`
  );

  log(
    `User message: ${options.userMessage}`
  );

  const response =
    await ai.models.generateContent({
      model,

      contents:
        options.userMessage,

      config: {
        systemInstruction:
          options.systemInstruction ??
          "You are a helpful assistant for University of Ibadan students.",
      },
    });

  const elapsedMs =
    Date.now() - startedAt;

  const text =
    response.text?.trim();

  if (!text) {
    throw new Error(
      `Model ${model} returned an empty response.`
    );
  }

  log(
    `Response received from ${model} in ${elapsedMs}ms. Response length: ${text.length} characters.`
  );

  return text;
}

// ---------------------------------------------------------
// CONTEXT-AWARE GEMINI REQUEST
// ---------------------------------------------------------

async function requestFromModelWithContext(
  model: string,
  context: AIContext
): Promise<string> {
  const startedAt =
    Date.now();

  const systemInstruction =
    buildSystemInstruction(
      context
    );

  const contents =
    buildConversationContents(
      context
    );

  const contextSize =
    estimateContextSize(
      context
    );

  log(
    `Sending contextual request to model: ${model}`
  );

  log(
    `Conversation messages supplied: ${context.messages.length}`
  );

  log(
    `First message: ${context.isFirstMessage}`
  );

  log(
    `Current message: ${context.currentMessage}`
  );

  log(
    `Estimated context size: ${contextSize.characters} chars / ~${contextSize.estimatedTokens} tokens`
  );

  log(
    `System instruction size: ${systemInstruction.length} chars / ~${estimateTokens(systemInstruction)} tokens`
  );

  const response =
    await ai.models.generateContent({
      model,

      contents,

      config: {
        systemInstruction,
      },
    });

  const elapsedMs =
    Date.now() - startedAt;

  const text =
    response.text?.trim();

  if (!text) {
    throw new Error(
      `Model ${model} returned an empty response.`
    );
  }

  log(
    `Contextual response received from ${model} in ${elapsedMs}ms. Response length: ${text.length} characters.`
  );

  log(
    `Estimated output size: ~${estimateTokens(text)} tokens`
  );

  return text;
}

// ---------------------------------------------------------
// PUBLIC AI SERVICE
// ---------------------------------------------------------

export async function generateAIResponse(
  options: GenerateAIResponseOptions
): Promise<string> {
  const startedAt =
    Date.now();

  log(
    "========================================"
  );

  log(
    "Starting AI response generation"
  );

  log(
    `Models available: ${models.join(" → ")}`
  );

  log(
    `Primary model: ${primaryModel}`
  );

  log(
    `Total models in pool: ${models.length}`
  );

  log(
    "========================================"
  );

  let lastError:
    | unknown
    | undefined;

  for (
    let modelIndex = 0;
    modelIndex < models.length;
    modelIndex++
  ) {
    const model =
      models[modelIndex];

    log(
      `Model ${modelIndex + 1}/${models.length}: ${model}`
    );

    for (
      let attempt = 1;
      attempt <= maxAttemptsPerModel;
      attempt++
    ) {
      const attemptStartedAt =
        Date.now();

      log(
        `Attempt ${attempt}/${maxAttemptsPerModel} using ${model}`
      );

      try {
        const response =
          await requestFromModel(
            model,
            options
          );

        const totalElapsedMs =
          Date.now() - startedAt;

        log(
          `AI generation successful using ${model}. Total time: ${totalElapsedMs}ms`
        );

        log(
          "========================================"
        );

        return response;
      } catch (requestError) {
        lastError =
          requestError;

        const attemptElapsedMs =
          Date.now() -
          attemptStartedAt;

        const status =
          getErrorStatus(
            requestError
          );

        warn(
          `Model ${model} failed on attempt ${attempt} after ${attemptElapsedMs}ms.`
        );

        if (
          status !== undefined
        ) {
          warn(
            `Gemini/API status: ${status}`
          );
        }

        warn(
          `Error: ${getErrorDescription(requestError)}`
        );

        // -------------------------------------------------
        // 429 → IMMEDIATE FAILOVER
        // -------------------------------------------------

        if (
          isRateLimitError(
            requestError
          )
        ) {
          warn(
            `Model ${model} returned 429. Skipping retries and moving to the next model.`
          );

          break;
        }

        // -------------------------------------------------
        // NON-RETRYABLE ERROR
        // -------------------------------------------------

        if (
          !isRetryableOnSameModel(
            requestError
          )
        ) {
          error(
            `Non-retryable error from ${model}.`
          );

          throw requestError;
        }

        // -------------------------------------------------
        // RETRY TEMPORARY SERVER / NETWORK ERRORS
        // -------------------------------------------------

        if (
          attempt <
          maxAttemptsPerModel
        ) {
          warn(
            `Temporary failure detected. Retrying ${model} in ${retryDelayMs}ms...`
          );

          await sleep(
            retryDelayMs
          );

          continue;
        }

        warn(
          `Model ${model} exhausted all ${maxAttemptsPerModel} attempts.`
        );

        break;
      }
    }

    // -----------------------------------------------------
    // FALLBACK MODEL
    // -----------------------------------------------------

    if (
      modelIndex <
      models.length - 1
    ) {
      const nextModel =
        models[modelIndex + 1];

      warn(
        `Failing over from ${model} → ${nextModel}`
      );

      continue;
    }

    warn(
      "No fallback models remain."
    );
  }

  const totalElapsedMs =
    Date.now() - startedAt;

  error(
    `All Gemini models failed after ${totalElapsedMs}ms.`
  );

  error(
    `Last error: ${getErrorDescription(lastError)}`
  );

  log(
    "========================================"
  );

  throw new Error(
    "All configured Gemini AI models are currently unavailable. Please try again shortly."
  );
}

// ---------------------------------------------------------
// CONTEXT-AWARE PUBLIC AI SERVICE
// ---------------------------------------------------------

export async function generateAIResponseFromContext(
  context: AIContext
): Promise<string> {
  const startedAt =
    Date.now();

  log(
    "========================================"
  );

  log(
    "Starting contextual AI response generation"
  );

  log(
    `Models available: ${models.join(" → ")}`
  );

  log(
    `Primary model: ${primaryModel}`
  );

  log(
    `Conversation messages: ${context.messages.length}`
  );

  log(
    `First message: ${context.isFirstMessage}`
  );

  log(
    `Memories available: ${context.memories.length}`
  );

  log(
    "========================================"
  );

  let lastError:
    | unknown
    | undefined;

  for (
    let modelIndex = 0;
    modelIndex < models.length;
    modelIndex++
  ) {
    const model =
      models[modelIndex];

    log(
      `Model ${modelIndex + 1}/${models.length}: ${model}`
    );

    for (
      let attempt = 1;
      attempt <= maxAttemptsPerModel;
      attempt++
    ) {
      const attemptStartedAt =
        Date.now();

      log(
        `Attempt ${attempt}/${maxAttemptsPerModel} using ${model}`
      );

      try {
        const response =
          await requestFromModelWithContext(
            model,
            context
          );

        const totalElapsedMs =
          Date.now() - startedAt;

        log(
          `Contextual AI generation successful using ${model}. Total time: ${totalElapsedMs}ms`
        );

        log(
          "========================================"
        );

        return response;
      } catch (requestError) {
        lastError =
          requestError;

        const attemptElapsedMs =
          Date.now() -
          attemptStartedAt;

        const status =
          getErrorStatus(
            requestError
          );

        warn(
          `Model ${model} failed on attempt ${attempt} after ${attemptElapsedMs}ms.`
        );

        if (
          status !== undefined
        ) {
          warn(
            `Gemini/API status: ${status}`
          );
        }

        warn(
          `Error: ${getErrorDescription(requestError)}`
        );

        // -------------------------------------------------
        // 429 → IMMEDIATE FAILOVER
        // -------------------------------------------------

        if (
          isRateLimitError(
            requestError
          )
        ) {
          warn(
            `Model ${model} returned 429. Skipping retries and moving to the next model.`
          );

          break;
        }

        // -------------------------------------------------
        // NON-RETRYABLE ERROR
        // -------------------------------------------------

        if (
          !isRetryableOnSameModel(
            requestError
          )
        ) {
          error(
            `Non-retryable error from ${model}.`
          );

          throw requestError;
        }

        // -------------------------------------------------
        // RETRY TEMPORARY ERRORS
        // -------------------------------------------------

        if (
          attempt <
          maxAttemptsPerModel
        ) {
          warn(
            `Temporary failure detected. Retrying ${model} in ${retryDelayMs}ms...`
          );

          await sleep(
            retryDelayMs
          );

          continue;
        }

        warn(
          `Model ${model} exhausted all ${maxAttemptsPerModel} attempts.`
        );

        break;
      }
    }

    // -----------------------------------------------------
    // FALLBACK MODEL
    // -----------------------------------------------------

    if (
      modelIndex <
      models.length - 1
    ) {
      const nextModel =
        models[modelIndex + 1];

      warn(
        `Failing over from ${model} → ${nextModel}`
      );

      continue;
    }

    warn(
      "No fallback models remain."
    );
  }

  const totalElapsedMs =
    Date.now() - startedAt;

  error(
    `All Gemini models failed after ${totalElapsedMs}ms.`
  );

  error(
    `Last error: ${getErrorDescription(lastError)}`
  );

  log(
    "========================================"
  );

  throw new Error(
    "All configured Gemini AI models are currently unavailable. Please try again shortly."
  );
}