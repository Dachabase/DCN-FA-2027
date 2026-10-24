import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getDefaultAllowedOrigins, isOriginAllowed } from "../src/config/cors";

describe("Domain Migration to https://blastexams.app", () => {
  it("includes canonical apex and www domains in CORS default allowlist", () => {
    const origins = getDefaultAllowedOrigins();
    assert.ok(origins.includes("https://blastexams.app"), "Missing https://blastexams.app in CORS defaults");
    assert.ok(origins.includes("https://www.blastexams.app"), "Missing https://www.blastexams.app in CORS defaults");
    assert.ok(origins.includes("https://dcn-fa-2027.onrender.com"), "Missing transitional legacy domain in CORS defaults");

    // Origin check
    assert.equal(isOriginAllowed("https://blastexams.app", origins), true);
    assert.equal(isOriginAllowed("https://www.blastexams.app", origins), true);
    assert.equal(isOriginAllowed("https://dcn-fa-2027.onrender.com", origins), true);
  });

  it("verifies public/index.html contains canonical tag and OpenGraph URLs", () => {
    const indexPath = path.join(__dirname, "../public/index.html");
    const content = fs.readFileSync(indexPath, "utf-8");

    assert.ok(content.includes('<link rel="canonical" href="https://blastexams.app/">'), "Missing canonical link tag");
    assert.ok(content.includes('<meta property="og:url" content="https://blastexams.app/">'), "Missing og:url meta tag");
    assert.ok(content.includes('<meta property="og:site_name" content="BlastExams">'), "Missing og:site_name meta tag");
  });

  it("verifies public/manifest.json contains canonical id and scopes", () => {
    const manifestPath = path.join(__dirname, "../public/manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

    assert.equal(manifest.id, "https://blastexams.app/");
    assert.equal(manifest.scope, "/");
    assert.equal(manifest.name, "BlastExams");
  });

  it("verifies public/robots.txt contains correct canonical sitemap declaration", () => {
    const robotsPath = path.join(__dirname, "../public/robots.txt");
    const content = fs.readFileSync(robotsPath, "utf-8");

    assert.ok(content.includes("Sitemap: https://blastexams.app/sitemap.xml"));
    assert.ok(content.includes("Allow: /"));
  });

  it("verifies public/sitemap.xml contains https://blastexams.app entry", () => {
    const sitemapPath = path.join(__dirname, "../public/sitemap.xml");
    const content = fs.readFileSync(sitemapPath, "utf-8");

    assert.ok(content.includes("<loc>https://blastexams.app/</loc>"));
    assert.ok(content.includes("<loc>https://blastexams.app/#/home</loc>"));
    assert.ok(content.includes("<loc>https://blastexams.app/#/utme</loc>"));
    assert.ok(content.includes("<loc>https://blastexams.app/#/100l</loc>"));
  });

  it("verifies render.yaml configures APP_URL to https://blastexams.app", () => {
    const renderPath = path.join(__dirname, "../render.yaml");
    const content = fs.readFileSync(renderPath, "utf-8");

    assert.ok(content.includes("key: APP_URL"));
    assert.ok(content.includes("value: https://blastexams.app"));
  });
});
