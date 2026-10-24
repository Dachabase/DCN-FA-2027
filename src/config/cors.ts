import type { CorsOptions } from "cors";

/**
 * Normalizes an origin string by trimming whitespace and removing trailing slashes.
 */
export function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, "");
}

/**
 * Returns a list of default allowed origins including production canonical domain and local dev.
 */
export function getDefaultAllowedOrigins(): string[] {
  return [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "https://blastexams.app",
    "https://www.blastexams.app",
    "https://dcn-fa-2027.onrender.com",
  ];
}

/**
 * Parses and returns the list of allowed origins from configuration and defaults.
 */
export function getAllowedOrigins(envValue: string | undefined = process.env.CORS_ALLOWED_ORIGINS): string[] {
  const origins = new Set<string>(getDefaultAllowedOrigins().map(normalizeOrigin));

  // Add configured production URLs from environment variables if present
  if (process.env.APP_URL) {
    origins.add(normalizeOrigin(process.env.APP_URL));
  }
  if (process.env.RENDER_EXTERNAL_URL) {
    origins.add(normalizeOrigin(process.env.RENDER_EXTERNAL_URL));
  }

  // Parse comma-separated list from CORS_ALLOWED_ORIGINS
  if (envValue && envValue.trim() !== "") {
    const parts = envValue.split(",");
    for (const part of parts) {
      const normalized = normalizeOrigin(part);
      if (normalized) {
        origins.add(normalized);
      }
    }
  }

  return Array.from(origins);
}

/**
 * Determines whether a given request origin is permitted by the allowlist.
 */
export function isOriginAllowed(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin) {
    return false;
  }
  const normalized = normalizeOrigin(origin);
  return allowedOrigins.includes(normalized);
}

/**
 * Generates an Express CORS configuration with explicit allowlist checking and credentials support.
 */
export function createCorsOptions(): CorsOptions {
  return {
    origin: (requestOrigin, callback) => {
      // 1. Allow requests with no origin (mobile apps, curl, server-to-server health checks)
      if (!requestOrigin) {
        return callback(null, true);
      }

      const allowedOrigins = getAllowedOrigins();

      // 2. Validate against explicit allowlist
      if (isOriginAllowed(requestOrigin, allowedOrigins)) {
        // Return the specific origin so Access-Control-Allow-Origin reflects it with credentials: true
        return callback(null, true);
      }

      // 3. Unauthorized origin: return false so the Access-Control-Allow-Origin header is omitted,
      // preventing the browser from reading the response.
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cookie",
      "X-Target-Audience",
      "X-Audience",
      "X-Requested-With",
      "Accept",
    ],
    exposedHeaders: ["Set-Cookie"],
    maxAge: 86400,
  };
}
