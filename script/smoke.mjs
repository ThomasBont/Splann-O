#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

function assertSupportedNodeVersion() {
  const major = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  if (!Number.isFinite(major) || major < 20 || major >= 23) {
    throw new Error(`Unsupported Node version ${process.versions.node}. Expected >=20 <23.`);
  }
}

function assertBuildArtifactsPresent() {
  const distEntry = path.resolve(process.cwd(), "dist/index.cjs");
  if (!fs.existsSync(distEntry)) {
    throw new Error("Missing dist/index.cjs. Run `npm run build` before smoke test.");
  }
}

function assertNoKnownCjsImportMetaRegression() {
  const passportSource = fs.readFileSync(path.resolve(process.cwd(), "server/lib/passport.ts"), "utf8");
  if (passportSource.includes("createRequire(import.meta.url)")) {
    throw new Error("Detected createRequire(import.meta.url) in passport.ts (breaks CJS runtime builds).");
  }
}

function assertBuiltEntryIsParseable() {
  const distEntry = path.resolve(process.cwd(), "dist/index.cjs");
  const code = fs.readFileSync(distEntry, "utf8");
  new vm.Script(code, { filename: distEntry });
}

async function main() {
  assertSupportedNodeVersion();
  assertBuildArtifactsPresent();
  assertNoKnownCjsImportMetaRegression();
  assertBuiltEntryIsParseable();
  console.log(`[smoke] OK on Node ${process.versions.node}`);
}

main().catch((error) => {
  console.error(`[smoke] FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
