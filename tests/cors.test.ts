import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeOrigin,
  getDefaultAllowedOrigins,
  getAllowedOrigins,
  isOriginAllowed,
  createCorsOptions,
} from "../src/config/cors";

describe("CORS Configuration & Allowlist", () => {
  it("normalizes origin strings by stripping trailing slashes and whitespace", () => {
    assert.equal(normalizeOrigin("https://example.com/"), "https://example.com");
    assert.equal(normalizeOrigin("  http://localhost:3000/// "), "http://localhost:3000");
    assert.equal(normalizeOrigin("https://sub.domain.org"), "https://sub.domain.org");
  });

  it("includes default local development and canonical production origins", () => {
    const defaults = getDefaultAllowedOrigins();
    assert.ok(defaults.includes("http://localhost:3000"));
    assert.ok(defaults.includes("http://localhost:5173"));
    assert.ok(defaults.includes("http://127.0.0.1:3000"));
    assert.ok(defaults.includes("http://127.0.0.1:5173"));
    assert.ok(defaults.includes("https://blastexams.app"));
    assert.ok(defaults.includes("https://www.blastexams.app"));
    assert.ok(defaults.includes("https://dcn-fa-2027.onrender.com"));
  });

  it("parses custom comma-separated origins from CORS_ALLOWED_ORIGINS", () => {
    const custom = "https://freshers.uicomputing.org, https://ui-companion.onrender.com/, http://custom-client.local";
    const origins = getAllowedOrigins(custom);

    assert.ok(origins.includes("https://freshers.uicomputing.org"));
    assert.ok(origins.includes("https://ui-companion.onrender.com"));
    assert.ok(origins.includes("http://custom-client.local"));
    assert.ok(origins.includes("http://localhost:3000"));
  });

  it("permits allowed origins and rejects unauthorized origins", () => {
    const allowed = ["http://localhost:3000", "https://app.example.com"];

    assert.equal(isOriginAllowed("http://localhost:3000", allowed), true);
    assert.equal(isOriginAllowed("http://localhost:3000/", allowed), true);
    assert.equal(isOriginAllowed("https://app.example.com", allowed), true);

    // Disallowed origins
    assert.equal(isOriginAllowed("https://evil-attacker.com", allowed), false);
    assert.equal(isOriginAllowed("http://localhost:8080", allowed), false);
    assert.equal(isOriginAllowed(undefined, allowed), false);
    assert.equal(isOriginAllowed("", allowed), false);
  });

  it("configures CORS middleware with credentials and allowlist checking", (t, done) => {
    const corsOptions = createCorsOptions();
    assert.equal(corsOptions.credentials, true);
    assert.ok(Array.isArray(corsOptions.methods));

    const originFn = corsOptions.origin as (
      requestOrigin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) => void;

    assert.equal(typeof originFn, "function");

    // 1. Request without origin (e.g. curl, health check, server-to-server) should be permitted
    originFn(undefined, (err, allow) => {
      assert.equal(err, null);
      assert.equal(allow, true);

      // 2. Request from allowed origin should be permitted
      originFn("http://localhost:3000", (err2, allow2) => {
        assert.equal(err2, null);
        assert.equal(allow2, true);

        // 3. Request from unauthorized origin must NOT receive CORS permission
        originFn("https://malicious-site.com", (err3, allow3) => {
          assert.equal(err3, null);
          assert.equal(allow3, false, "Unauthorized origin should receive allow=false to omit CORS header");
          done();
        });
      });
    });
  });
});
