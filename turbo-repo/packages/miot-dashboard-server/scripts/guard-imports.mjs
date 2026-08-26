#!/usr/bin/env node
/**
 * Import guard for @microboxlabs/miot-dashboard-server.
 *
 * Enforced as part of `check-types` (a hard CI gate) so violations fail CI.
 *
 * The whole value of this package is that a host mounts it without adopting
 * our stack, so the boundaries are mechanical rather than a matter of taste:
 *
 *  1. No React, ever — this is a backend. Of the UI package, only its
 *     React-free "/schema" subpath may be imported; everything else there is
 *     React and carries a "use client" banner.
 *  2. No framework imports in the core. `next/*` is confined to
 *     src/adapters/next/, `fastify` to src/adapters/fastify/ — everything
 *     else must run under a bare Node process.
 *  3. No app internals and no Alfresco-shaped code: Alfresco is one possible
 *     ServerDashboardStore implementation, supplied by the host, never a
 *     thing this package knows about.
 *
 * Rules are matched against the *module specifier*, not the raw line, so
 * side-effect (`import "x"`), dynamic (`await import("x")`) and CommonJS
 * (`require("x")`) forms are caught alongside `from "x"`. Scanning only
 * `from` clauses would let a forbidden dependency through a gate whose whole
 * job is to stop one.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath, not URL.pathname: the latter yields a URL path, which keeps
// percent-encoding and gains a leading slash before a Windows drive letter.
// Matches the convention in apps/app/scripts/build-search-index.mjs.
const SRC = fileURLToPath(new URL("../src", import.meta.url));

/**
 * Every module specifier on a line, across all import forms:
 *   from "x" · export … from "x" · import "x" · import("x") · require("x")
 */
const SPECIFIER_RE = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["']([^"']+)["']/g;

/** The one UI subpath a backend may import — React-free by construction. */
const UI_SCHEMA_ENTRY = "@microboxlabs/miot-dashboard-ui/schema";

/** Rules applied to the specifier of every import under src/ */
const SPECIFIER_RULES = [
  {
    test: (s) => /^react(-dom)?(\/|$)/.test(s),
    why: "React import (this is a backend package)",
  },
  {
    // Allowlist rather than a blocklist of known-bad subpaths: a new UI entry
    // must not silently become reachable from the server just because nobody
    // remembered to ban it here.
    test: (s) =>
      /^@microboxlabs\/miot-dashboard-ui(\/|$)/.test(s) &&
      s !== UI_SCHEMA_ENTRY,
    why: `UI package import other than "${UI_SCHEMA_ENTRY}" (every other entry is React / "use client")`,
  },
  { test: (s) => /^@\/features\//.test(s), why: "app-internal import (@/features/*)" },
  {
    test: (s) => /^@modulariot\/app(\/|$)/.test(s),
    why: "app package import (@modulariot/app)",
  },
];

/**
 * Framework specifiers, each legal only inside its own adapter directory.
 * Anywhere else they would make the core un-mountable by a different host.
 */
const FRAMEWORK_RULES = [
  {
    test: (s) => /^next(\/|$)/.test(s),
    why: "Next.js import outside src/adapters/next/",
    allowedPrefix: "adapters/next/",
  },
  {
    test: (s) => /^fastify(\/|$)/.test(s),
    why: "Fastify import outside src/adapters/fastify/",
    allowedPrefix: "adapters/fastify/",
  },
];

/** True for whole-line comments (//, /*, * continuation, */
const isCommentLine = (line) => /^\s*(\/\/|\/\*|\*)/.test(line.trimStart());

/**
 * Content rules match the raw line, not a specifier — they catch references
 * that are not imports at all.
 */
const CONTENT_RULES = [
  {
    re: /alfresco/i,
    why: "Alfresco reference in code (host persistence stays behind the ServerDashboardStore seam)",
    // Doc comments legitimately explain that Alfresco is one host's
    // implementation, so comment lines are exempt from this rule only.
    skipComments: true,
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
  const specifierRules = [
    ...SPECIFIER_RULES,
    ...FRAMEWORK_RULES.filter((r) => !rel.startsWith(r.allowedPrefix)),
  ];
  const lines = readFileSync(file, "utf8").split("\n");

  lines.forEach((line, i) => {
    const at = `src/${rel}:${i + 1}`;

    for (const specifier of line.matchAll(SPECIFIER_RE)) {
      const moduleId = specifier[1];
      for (const { test, why } of specifierRules) {
        if (test(moduleId)) {
          violations.push(`${at} — ${why}\n    ${line.trim()}`);
        }
      }
    }

    for (const { re, why, skipComments } of CONTENT_RULES) {
      if (skipComments && isCommentLine(line)) continue;
      if (re.test(line)) violations.push(`${at} — ${why}\n    ${line.trim()}`);
    }
  });
}

if (violations.length > 0) {
  console.error(`guard-imports: ${violations.length} forbidden import(s) found:\n`);
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
console.log("guard-imports: OK");
