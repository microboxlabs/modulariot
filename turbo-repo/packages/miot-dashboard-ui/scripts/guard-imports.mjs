#!/usr/bin/env node
/**
 * Import guard for @microboxlabs/miot-dashboard-ui.
 *
 * Enforced as part of `check-types` (a hard CI gate) so violations fail CI:
 *  1. Nowhere in src/ may the package import app internals, Next.js, or
 *     Alfresco-shaped code — the package must stay framework-agnostic and
 *     host-agnostic (plan §3 seams, §8 non-Next lens).
 *  2. src/core/ must stay React-free — it is the pure-TS engine layer that
 *     keeps a future non-React renderer possible (plan §8 non-React lens).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = new URL("../src", import.meta.url).pathname;

/** Rules applied to every file under src/ */
const GLOBAL_RULES = [
  { re: /@\/features\//, why: "app-internal import (@/features/*)" },
  { re: /@modulariot\/app/, why: "app package import (@modulariot/app)" },
  { re: /from\s+["']next(\/|["'])/, why: "Next.js import (framework-agnostic package)" },
  { re: /require\(\s*["']next(\/|["'])/, why: "Next.js require (framework-agnostic package)" },
  { re: /alfresco/i, why: "Alfresco reference (host persistence must stay behind Seam E)" },
];

/** Extra rules for the pure-TS core layer */
const CORE_RULES = [
  { re: /from\s+["']react(-dom)?(\/|["'])/, why: "React import in src/core (core must stay React-free)" },
];

function walk(dir) {
  let files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(walk(path));
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) files.push(path);
  }
  return files;
}

const violations = [];
for (const file of walk(SRC)) {
  const rel = relative(SRC, file);
  const rules = rel.startsWith("core/") || rel.startsWith(`core${join("/")}`)
    ? [...GLOBAL_RULES, ...CORE_RULES]
    : GLOBAL_RULES;
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const { re, why } of rules) {
      if (re.test(line)) violations.push(`src/${rel}:${i + 1} — ${why}\n    ${line.trim()}`);
    }
  });
}

if (violations.length > 0) {
  console.error(`guard-imports: ${violations.length} forbidden import(s) found:\n`);
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
console.log("guard-imports: OK");
