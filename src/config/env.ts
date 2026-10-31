// Safely load local .env if present (supported natively in Node.js 20.6+)
try {
  if (typeof (process as any).loadEnvFile === "function") {
    (process as any).loadEnvFile();
  }
} catch {
  // Environment variables may be injected by container/host environment
}

/**
 * Resolves the canonical Telegram Bot Token with backward-compatibility alias support.
 * Canonical: TELEGRAM_COMPUTING_BOT_TOKEN
 * Legacy Alias: TELEGRAM_BOT_TOKEN
 */
export function resolveTelegramToken(rawEnv: Record<string, string | undefined> = process.env): {
  token: string | undefined;
  source: "canonical" | "alias" | "none";
  warning?: string;
} {
  const canonical = rawEnv.TELEGRAM_COMPUTING_BOT_TOKEN?.trim();
  const alias = rawEnv.TELEGRAM_BOT_TOKEN?.trim();

  if (canonical && alias) {
    if (canonical !== alias) {
      return {
        token: canonical,
        source: "canonical",
        warning:
          "[Config Warning] Both TELEGRAM_COMPUTING_BOT_TOKEN and legacy TELEGRAM_BOT_TOKEN are defined with conflicting values. Canonical TELEGRAM_COMPUTING_BOT_TOKEN takes precedence.",
      };
    }
    return { token: canonical, source: "canonical" };
  }

  if (canonical) {
    return { token: canonical, source: "canonical" };
  }

  if (alias) {
    return {
      token: alias,
      source: "alias",
      warning:
        "[Config Notice] Using legacy TELEGRAM_BOT_TOKEN as fallback alias. Please update configuration to use TELEGRAM_COMPUTING_BOT_TOKEN.",
    };
  }

  return { token: undefined, source: "none" };
}

export interface AppEnv {
  NODE_ENV: "development" | "production" | "test";
  PORT: number;
  APP_URL: string;
  DATABASE_URL?: string;
  TELEGRAM_COMPUTING_BOT_TOKEN?: string;
  DEFAULT_TELEGRAM_BOT_USERNAME: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL: string;
  GEMINI_FALLBACK_MODELS: string;
  JWT_SECRET?: string;
  JWT_REFRESH_SECRET?: string;
  CORS_ALLOWED_ORIGINS?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_DRIVE_RESOURCES_URL?: string;
  DB_POOL_MAX: number;
  DB_SSL_STRICT: string;
}

/**
 * Validates and parses environment configuration without exposing secret values.
 */
export function parseAndValidateEnv(rawEnv: Record<string, string | undefined> = process.env): AppEnv {
  const tokenResolution = resolveTelegramToken(rawEnv);
  if (tokenResolution.warning && rawEnv.NODE_ENV !== "test") {
    console.warn(tokenResolution.warning);
  }

  const nodeEnvRaw = rawEnv.NODE_ENV || "development";
  const nodeEnv = (["development", "production", "test"].includes(nodeEnvRaw)
    ? nodeEnvRaw
    : "development") as "development" | "production" | "test";

  const port = rawEnv.PORT ? parseInt(rawEnv.PORT, 10) : 3000;
  if (isNaN(port) || port <= 0 || port > 65535) {
    throw new Error("Invalid PORT environment variable. Must be a valid TCP port number.");
  }

  const poolMax = rawEnv.DB_POOL_MAX ? parseInt(rawEnv.DB_POOL_MAX, 10) : 20;

  const envData: AppEnv = {
    NODE_ENV: nodeEnv,
    PORT: port,
    APP_URL: rawEnv.APP_URL?.trim() || "https://blastexams.app",
    DATABASE_URL: rawEnv.DATABASE_URL?.trim() || undefined,
    TELEGRAM_COMPUTING_BOT_TOKEN: tokenResolution.token,
    DEFAULT_TELEGRAM_BOT_USERNAME: rawEnv.DEFAULT_TELEGRAM_BOT_USERNAME?.trim() || "UIDCNComputingFreshersBot",
    GEMINI_API_KEY: rawEnv.GEMINI_API_KEY?.trim() || undefined,
    GEMINI_MODEL: rawEnv.GEMINI_MODEL?.trim() || "gemini-3.7-flash",
    GEMINI_FALLBACK_MODELS: rawEnv.GEMINI_FALLBACK_MODELS?.trim() || "gemini-3.6-flash",
    JWT_SECRET: rawEnv.JWT_SECRET?.trim() || undefined,
    JWT_REFRESH_SECRET: rawEnv.JWT_REFRESH_SECRET?.trim() || undefined,
    CORS_ALLOWED_ORIGINS: rawEnv.CORS_ALLOWED_ORIGINS?.trim() || undefined,
    GOOGLE_CLIENT_ID: rawEnv.GOOGLE_CLIENT_ID?.trim() || undefined,
    GOOGLE_CLIENT_SECRET: rawEnv.GOOGLE_CLIENT_SECRET?.trim() || undefined,
    GOOGLE_DRIVE_RESOURCES_URL: rawEnv.GOOGLE_DRIVE_RESOURCES_URL?.trim() || undefined,
    DB_POOL_MAX: isNaN(poolMax) ? 20 : poolMax,
    DB_SSL_STRICT: rawEnv.DB_SSL_STRICT?.trim() || "false",
  };

  // Strict production assertions
  if (envData.NODE_ENV === "production") {
    if (!envData.DATABASE_URL) {
      throw new Error("DATABASE_URL is required in production environment. Please configure it in Render Environment.");
    }
  }

  return envData;
}

export const env = parseAndValidateEnv();
