// Locks the API behind sign-in. Run from the project root (the folder that contains src/server.ts):
//   node backend-round7/apply-gate.mjs
// It copies two small files into src/, backs up src/server.ts, and adds 2 imports + 2 lines. Safe to run twice.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.cwd();
const serverPath = path.join(root, "src", "server.ts");
if (!fs.existsSync(serverPath)) {
  console.error("Run this from the project root (the folder that contains src/server.ts).");
  process.exit(1);
}

for (const rel of ["src/auth/apiGate.ts", "src/public/landing.router.ts"]) {
  const to = path.join(root, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(path.join(here, rel), to);
  console.log("copied  " + rel);
}

let s = fs.readFileSync(serverPath, "utf8");
if (s.includes("apiGate")) {
  console.log("server.ts already has the gate. Nothing more to change.");
  process.exit(0);
}

const eol = s.includes("\r\n") ? "\r\n" : "\n";
const anchor = 'app.use("/auth", authRouter);';
const before = 'app.use("/api", personalizationRouter);';
const a = s.indexOf(anchor);
const b = s.indexOf(before);
if (a < 0 || b < 0 || b < a) {
  console.error("Could not find the expected lines in src/server.ts, so nothing was changed there.");
  console.error('Add these by hand: put app.use("/api/public", publicRouter); and app.use("/api", apiGate);');
  console.error('right after app.use("/auth", authRouter); and before app.use("/api", personalizationRouter);');
  console.error('plus: import { apiGate } from "./auth/apiGate"; import { publicRouter } from "./public/landing.router";');
  process.exit(1);
}

fs.copyFileSync(serverPath, serverPath + ".bak");

// imports go after the last single-line import
const imports = [...s.matchAll(/^import .*;\r?$/gm)];
const last = imports[imports.length - 1];
const at = last.index + last[0].length;
s = s.slice(0, at) + eol + 'import { apiGate } from "./auth/apiGate";' + eol + 'import { publicRouter } from "./public/landing.router";' + s.slice(at);

// the gate goes right after the /auth mount, above every other /api route
const a2 = s.indexOf(anchor) + anchor.length;
s = s.slice(0, a2) + eol + 'app.use("/api/public", publicRouter);' + eol + 'app.use("/api", apiGate); // everything else under /api needs a signed-in user' + s.slice(a2);

fs.writeFileSync(serverPath, s);
console.log("updated src/server.ts (backup saved as src/server.ts.bak)");
console.log("Next: npm run build, then open a private window. /api/guides should answer 401.");
