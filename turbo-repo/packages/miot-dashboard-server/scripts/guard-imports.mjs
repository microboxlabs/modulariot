#!/usr/bin/env node
/**
 * Import guard for @microboxlabs/miot-dashboard-server.
 *
 * Enforced as part of `check-types` (a hard CI gate) so violations fail CI.
 *
 * The whole value of this package is that a host mounts it without adopting
 * our stack, so the boundaries are mechanical rather than a matter of taste:
 *
 *  1. No React, ever — this is a backend. (The UI package's React entries are
 *     also off-limits; only its React-free "/schema" subpath may be imported.)
 *  2. No framework imports in the core. `next/*` is confined to
 *     src/adapters/next/, `fastify` to src/adapters/fastify/ — everything
 *     else must run under a bare Node process.
 *  3. No app internals and no Alfresco-shaped code: Alfresco is one possible
 *     DashboardStore implementation, supplied by the host, never a thing this
 *     package knows about.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = new URL("../src", import.meta.url).pathname;

/** Rules applied to every file under src/ */
const GLOBAL_RULES = [
  { re: /@\/features\//, why: "app-internal import (@/features/*)" },
  { re: /@modulariot\/app/, why: "app package import (@modulariot/app)" },
  {
    re: /from\s+["']react(-dom)?(\/|["'])/,
    why: "React import (this is a backend package)",
  },
  {
    re: /from\s+["']@microboxlabs\/miot-dashboard-ui["']/,
    why: "UI package root entry is React + \"use client\" — import the React-free \"/schema\" subpath instead",
  },
  {
    re: /from\s+["']@microboxlabs\/miot-dashboard-ui\/charts["']/,
    why: "UI package charts entry bundles echarts — never reachable from a server",
  },
  // Code references only — doc comments legitimately explain that Alfresco is
  // one host's DashboardStore implementation.
  {
    re: /alfresco/i,
    why: "Alfresco reference in code (host persistence stays behind the DashboardStore seam)",
    skipComments: true,
  },
];

/** True for whole-line comments (//, /*, * continuation, */
const isCommentLine = (line) => /^\s*(\/\/|\/\*|\*)/.test(line.trimStart());

/**
 * Framework imports, each legal only inside its own adapter directory.
 * Anywhere else they would make the core un-mountable by a different host.
 */
const FRAMEWORK_RULES = [
  {
    re: /from\s+["']next(\/|["'])/,
    why: "Next.js import outside src/adapters/next/",
    allowedPrefix: "adapters/next/",
  },
  {
    re: /from\s+["']fastify(\/|["'])/,
    why: "Fastify import outside src/adapters/fastify/",
    allowedPrefix: "adapters/fastify/",
  },
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
  const rules = [
    ...GLOBAL_RULES,
    ...FRAMEWORK_RULES.filter((r) => !rel.startsWith(r.allowedPrefix)),
  ];
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const { re, why, skipComments } of rules) {
      if (skipComments && isCommentLine(line)) continue;
      if (re.test(line))
        violations.push(`src/${rel}:${i + 1} — ${why}\n    ${line.trim()}`);
    }
  });
}

if (violations.length > 0) {
  console.error(`guard-imports: ${violations.length} forbidden import(s) found:\n`);
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
console.log("guard-imports: OK");
