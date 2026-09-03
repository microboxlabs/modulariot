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
 *
 * The specifier scan runs over the whole file text rather than line by line,
 * because a specifier can legally sit on a line of its own:
 *
 *     await import(
 *       "react"
 *     )
 *
 * A line-based scan sees neither half as an import and waves it through.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath, not URL.pathname: the latter yields a URL path, which keeps
// percent-encoding and gains a leading slash before a Windows drive letter.
// Matches the convention in apps/app/scripts/build-search-index.mjs.
const SRC = fileURLToPath(new URL("../src", import.meta.url));

/**
 * Every module specifier in a file, across all import forms:
 *   from "x" · export … from "x" · import "x" · import("x") · require("x")
 *   · require.resolve("x")
 *
 * `require.resolve` is in the list because it makes a package a dependency
 * just as surely as importing it does — it is how an optional dependency is
 * located — and a gate that watched only the executing forms would wave it
 * through.
 *
 * `\s` matches newlines, so the keyword and its specifier may sit on
 * different lines.
 */
const SPECIFIER_RE =
  /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*(?:\.resolve\s*)?\(\s*)["']([^"']+)["']/g;

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
  {
    test: (s) => /^node:sqlite$/.test(s),
    why: "node:sqlite import outside src/store/ (persistence is an opt-in entry)",
    allowedPrefix: "store/",
  },
  {
    test: (s) => /^node:crypto$/.test(s),
    why: "node:crypto import outside src/identity/ (the core and the HTTP handler use the global WebCrypto instead)",
    // src/test/ mints signed tokens for the identity tests and ships nowhere.
    allowedPrefix: ["identity/", "test/"],
  },
  {
    // An optional dependency of the standalone server, and 11 MB of it. The
    // core and the HTTP handler must stay reachable without it installed at
    // all, which only holds while nothing outside the server layer names it.
    test: (s) => /^swagger-ui-dist(\/|$)/.test(s),
    why: "swagger-ui-dist reference outside src/server/ (optional, standalone-server only)",
    allowedPrefix: "server/",
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
    // esbuild rewrites this specifier to "sqlite", which resolves to nothing.
    re: /\bfrom\s*["']node:sqlite["']/,
    why: 'static import of node:sqlite (the bundler rewrites it to "sqlite"; use createRequire)',
    skipComments: true,
  },
  {
    re: /alfresco/i,
    why: "Alfresco reference in code (host persistence stays behind the ServerDashboardStore seam)",
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

/** `allowedPrefix` is one directory or several. */
const allowedPrefixes = (rule) =>
  Array.isArray(rule.allowedPrefix) ? rule.allowedPrefix : [rule.allowedPrefix];

const violations = [];
for (const file of walk(SRC)) {
  const rel = relative(SRC, file);
  const specifierRules = [
    ...SPECIFIER_RULES,
    ...FRAMEWORK_RULES.filter(
      (r) => !allowedPrefixes(r).some((prefix) => rel.startsWith(prefix)),
    ),
  ];
  const source = readFileSync(file, "utf8");

  // Specifiers: whole-file scan, so a multi-line import cannot straddle the
  // gate. Files here are small enough that counting newlines per match is cheap.
  const lineOf = (index) => source.slice(0, index).split("\n").length;

  for (const match of source.matchAll(SPECIFIER_RE)) {
    const moduleId = match[1];
    for (const { test, why } of specifierRules) {
      if (test(moduleId)) {
        // Report the match itself, not its first line: in a multi-line import
        // the first line is precisely the half that reads as innocent.
        const snippet = match[0].replace(/\s+/g, " ").trim();
        violations.push(`src/${rel}:${lineOf(match.index)} — ${why}\n    ${snippet}`);
      }
    }
  }

  // Content rules stay line-based: they match prose-shaped references, where the
  // line is the meaningful unit and a whole-file scan would report no location.
  source.split("\n").forEach((line, i) => {
    for (const { re, why, skipComments } of CONTENT_RULES) {
      if (skipComments && isCommentLine(line)) continue;
      if (re.test(line)) {
        violations.push(`src/${rel}:${i + 1} — ${why}\n    ${line.trim()}`);
      }
    }
  });
}

if (violations.length > 0) {
  console.error(`guard-imports: ${violations.length} forbidden import(s) found:\n`);
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
console.log("guard-imports: OK");
