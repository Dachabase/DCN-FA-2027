// Safely load local .env if present (supported natively in Node.js 20.6+)
try {
  if (typeof (process as any).loadEnvFile === "function") {
    (process as any).loadEnvFile();
  }
} catch {
  // Environment variables may be injected by container/host environment
}

export interface AppEnv {
  NODE_ENV: "development" | "production" | "test";
  PORT: number;
  APP_URL: string;
  DATABASE_URL?: string;
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
    if (!envData.JWT_SECRET) {
      throw new Error("JWT_SECRET is required in production environment. Please configure it in Render Environment.");
    }
    if (!envData.JWT_REFRESH_SECRET) {
      throw new Error("JWT_REFRESH_SECRET is required in production environment. Please configure it in Render Environment.");
    }
  }

  return envData;
}

export const env = parseAndValidateEnv();