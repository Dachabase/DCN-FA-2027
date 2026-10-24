import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveTelegramToken, parseAndValidateEnv } from "../src/config/env";

describe("Environment Configuration & Token Standardization", () => {
  it("resolves canonical TELEGRAM_COMPUTING_BOT_TOKEN when defined alone", () => {
    const res = resolveTelegramToken({
      TELEGRAM_COMPUTING_BOT_TOKEN: "canonical-token-12345",
    });

    assert.equal(res.token, "canonical-token-12345");
    assert.equal(res.source, "canonical");
    assert.equal(res.warning, undefined);
  });

  it("resolves legacy TELEGRAM_BOT_TOKEN as fallback alias with notice", () => {
    const res = resolveTelegramToken({
      TELEGRAM_BOT_TOKEN: "legacy-token-67890",
    });

    assert.equal(res.token, "legacy-token-67890");
    assert.equal(res.source, "alias");
    assert.ok(res.warning?.includes("Using legacy TELEGRAM_BOT_TOKEN as fallback alias"));
  });

  it("prioritizes canonical token when both are set with identical values", () => {
    const res = resolveTelegramToken({
      TELEGRAM_COMPUTING_BOT_TOKEN: "same-token",
      TELEGRAM_BOT_TOKEN: "same-token",
    });

    assert.equal(res.token, "same-token");
    assert.equal(res.source, "canonical");
    assert.equal(res.warning, undefined);
  });

  it("prioritizes canonical token with warning when both are set with conflicting values", () => {
    const res = resolveTelegramToken({
      TELEGRAM_COMPUTING_BOT_TOKEN: "canonical-value",
      TELEGRAM_BOT_TOKEN: "different-legacy-value",
    });

    assert.equal(res.token, "canonical-value");
    assert.equal(res.source, "canonical");
    assert.ok(res.warning?.includes("conflicting values"));
  });

  it("returns undefined when neither token is configured", () => {
    const res = resolveTelegramToken({});
    assert.equal(res.token, undefined);
    assert.equal(res.source, "none");
  });

  it("parses development environment with standard defaults", () => {
    const parsed = parseAndValidateEnv({
      NODE_ENV: "development",
      PORT: "4000",
      TELEGRAM_COMPUTING_BOT_TOKEN: "token-abc",
    });

    assert.equal(parsed.NODE_ENV, "development");
    assert.equal(parsed.PORT, 4000);
    assert.equal(parsed.DEFAULT_TELEGRAM_BOT_USERNAME, "UIDCNComputingFreshersBot");
    assert.equal(parsed.GEMINI_MODEL, "gemini-3.7-flash");
  });

  it("strictly enforces required variables in production mode", () => {
    // Missing DATABASE_URL in production
    assert.throws(
      () => {
        parseAndValidateEnv({
          NODE_ENV: "production",
          JWT_SECRET: "strong-secret",
          JWT_REFRESH_SECRET: "strong-refresh-secret",
        });
      },
      (err: Error) => {
        return err.message.includes("DATABASE_URL is required in production");
      }
    );

    // Missing JWT_SECRET in production
    assert.throws(
      () => {
        parseAndValidateEnv({
          NODE_ENV: "production",
          DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
          JWT_REFRESH_SECRET: "strong-refresh-secret",
        });
      },
      (err: Error) => {
        return err.message.includes("JWT_SECRET is required in production");
      }
    );
  });
});
