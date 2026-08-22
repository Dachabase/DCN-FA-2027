import "dotenv/config";

import { GoogleGenAI } from "@google/genai";

// ---------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error(
    "GEMINI_API_KEY is not configured. Add it to your .env file."
  );
}

const ai = new GoogleGenAI({
  apiKey,
});

const primaryModel =
  process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";

const fallbackModels = (process.env.GEMINI_FALLBACK_MODELS ?? "")
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);

const models = Array.from(
  new Set([primaryModel, ...fallbackModels])
);

// Number of attempts allowed for each model.
const maxAttemptsPerModel = 2;

// Delay before retrying the same model.
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

function log(message: string, ...args: unknown[]): void {
  console.log(`[${timestamp()}] [AI] ${message}`, ...args);
}

function warn(message: string, ...args: unknown[]): void {
  console.warn(`[${timestamp()}] [AI] ${message}`, ...args);
}

function error(message: string, ...args: unknown[]): void {
  console.error(`[${timestamp()}] [AI] ${message}`, ...args);
}

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorStatus(errorValue: unknown): number | undefined {
  if (
    typeof errorValue === "object" &&
    errorValue !== null &&
    "status" in errorValue
  ) {
    const status = (errorValue as { status?: unknown }).status;

    if (typeof status === "number") {
      return status;
    }
  }

  return undefined;
}

function isRetryableError(errorValue: unknown): boolean {
  const status = getErrorStatus(errorValue);

  // Gemini/API temporary availability problems.
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
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
    message.includes("temporarily unavailable") ||
    message.includes("unavailable")
  );
}

function getErrorDescription(errorValue: unknown): string {
  if (errorValue instanceof Error) {
    return errorValue.message;
  }

  return String(errorValue);
}

// ---------------------------------------------------------
// GEMINI REQUEST
// ---------------------------------------------------------

async function requestFromModel(
  model: string,
  options: GenerateAIResponseOptions
): Promise<string> {
  const startedAt = Date.now();

  log(`Sending request to model: ${model}`);
  log(`User message: ${options.userMessage}`);

  const response = await ai.models.generateContent({
    model,
    contents: options.userMessage,
    config: {
      systemInstruction:
        options.systemInstruction ??
        "You are a helpful assistant for University of Ibadan students.",
    },
  });

  const elapsedMs = Date.now() - startedAt;

  const text = response.text?.trim();

  if (!text) {
    throw new Error(`Model ${model} returned an empty response.`);
  }

  log(
    `Response received from ${model} in ${elapsedMs}ms. Response length: ${text.length} characters.`
  );

  return text;
}

// ---------------------------------------------------------
// PUBLIC AI SERVICE
// ---------------------------------------------------------

export async function generateAIResponse(
  options: GenerateAIResponseOptions
): Promise<string> {
  const startedAt = Date.now();

  log("========================================");
  log("Starting AI response generation");
  log(`Models available: ${models.join(" → ")}`);
  log(`Primary model: ${primaryModel}`);
  log(`Total models in pool: ${models.length}`);
  log("========================================");

  let lastError: unknown = undefined;

  for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
    const model = models[modelIndex];

    log(
      `Model ${modelIndex + 1}/${models.length}: ${model}`
    );

    for (
      let attempt = 1;
      attempt <= maxAttemptsPerModel;
      attempt++
    ) {
      const attemptStartedAt = Date.now();

      log(
        `Attempt ${attempt}/${maxAttemptsPerModel} using ${model}`
      );

      try {
        const response = await requestFromModel(model, options);

        const totalElapsedMs = Date.now() - startedAt;

        log(
          `AI generation successful using ${model}. Total time: ${totalElapsedMs}ms`
        );

        log("========================================");

        return response;
      } catch (requestError) {
        lastError = requestError;

        const attemptElapsedMs =
          Date.now() - attemptStartedAt;

        const status = getErrorStatus(requestError);

        warn(
          `Model ${model} failed on attempt ${attempt} after ${attemptElapsedMs}ms.`
        );

        if (status !== undefined) {
          warn(`Gemini/API status: ${status}`);
        }

        warn(
          `Error: ${getErrorDescription(requestError)}`
        );

        const retryable = isRetryableError(requestError);

        if (!retryable) {
          error(
            `Non-retryable error from ${model}. Stopping failover.`
          );

          throw requestError;
        }

        // Retry the same model if attempts remain.
        if (attempt < maxAttemptsPerModel) {
          warn(
            `Temporary failure detected. Retrying ${model} in ${retryDelayMs}ms...`
          );

          await sleep(retryDelayMs);

          continue;
        }

        // No attempts left for this model.
        warn(
          `Model ${model} exhausted all ${maxAttemptsPerModel} attempts.`
        );

        break;
      }
    }

    // Move to the next model.
    if (modelIndex < models.length - 1) {
      const nextModel = models[modelIndex + 1];

      warn(
        `Failing over from ${model} → ${nextModel}`
      );

      continue;
    }

    warn("No fallback models remain.");
  }

  const totalElapsedMs = Date.now() - startedAt;

  error(
    `All Gemini models failed after ${totalElapsedMs}ms.`
  );

  error(
    `Last error: ${getErrorDescription(lastError)}`
  );

  log("========================================");

  throw new Error(
    "All configured Gemini AI models are currently unavailable. Please try again shortly."
  );
}