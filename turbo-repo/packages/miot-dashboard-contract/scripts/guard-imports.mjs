#!/usr/bin/env node
/**
 * Import guard. Shipped code may import `zod` and its own siblings, and
 * nothing else — no `node:` builtin either, since browsers import this.
 * Tests and scripts use a looser list. Runs as part of `check-types`.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * Every module specifier, across all import forms:
 *   from "x" · export … from "x" · import "x" · import("x") · require("x")
 */
const SPECIFIER_RE =
  /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*(?:\.resolve\s*)?\(\s*)["']([^"']+)["']/g;

/** What the published bundle may reach for. */
const SHIPPED_ALLOWED = new Set(["zod"]);

/** Additionally allowed in tests and build scripts, which are not published. */
const TOOLING_ALLOWED = new Set([
  "vitest",
  "yaml",
  "zod-to-json-schema",
  "node:fs",
  "node:path",
  "node:url",
]);

/**
 * Strip comments before matching: a docstring containing `from "..."` reads
 * as an import. A scanner, not a regex, so string literals and their escapes
 * are followed and no real import is swallowed.
 */
function withoutComments(text) {
  let out = "";
  let index = 0;
  /** null in code, otherwise the delimiter or comment kind being scanned. */
  let inside = null;
  while (index < text.length) {
    const char = text[index];
    const next = text[index + 1];
    if (inside === null) {
      if (char === "/" && next === "/") {
        inside = "line";
        index += 2;
        continue;
      }
      if (char === "/" && next === "*") {
        inside = "block";
        index += 2;
        continue;
      }
      if (char === '"' || char === "'" || char === "`") inside = char;
      out += char;
      index += 1;
      continue;
    }
    if (inside === "line") {
      if (char === "\n") {
        inside = null;
        out += char;
      }
      index += 1;
      continue;
    }
    if (inside === "block") {
      if (char === "*" && next === "/") {
        inside = null;
        index += 2;
      } else {
        // Keep newlines so nothing downstream joins two statements.
        if (char === "\n") out += char;
        index += 1;
      }
      continue;
    }
    // Inside a string literal: an escaped delimiter does not end it.
    if (char === "\\") {
      out += char + (next ?? "");
      index += 2;
      continue;
    }
    if (char === inside) inside = null;
    out += char;
    index += 1;
  }
  return out;
}

function isRelative(specifier) {
  return specifier.startsWith("./") || specifier.startsWith("../");
}

function* walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (/\.(ts|mjs)$/.test(entry.name)) yield path;
  }
}

const problems = [];

const SELF = fileURLToPath(import.meta.url);

for (const directory of ["src", "scripts"]) {
  for (const file of walk(join(ROOT, directory))) {
    // Its own docstring spells out the import forms it looks for, so scanning
    // itself finds them and reports a module called "x".
    if (file === SELF) continue;
    const isTooling = directory === "scripts" || /\.test\.ts$/.test(file);
    const allowed = isTooling
      ? new Set([...SHIPPED_ALLOWED, ...TOOLING_ALLOWED])
      : SHIPPED_ALLOWED;
    const text = withoutComments(readFileSync(file, "utf8"));
    for (const [, specifier] of text.matchAll(SPECIFIER_RE)) {
      if (isRelative(specifier) || allowed.has(specifier)) continue;
      problems.push(
        `${relative(ROOT, file)}: imports "${specifier}", which ${
          isTooling
            ? "is not on the tooling allow-list"
            : "the published contract may not depend on"
        }`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error("guard-imports: the contract reached outside itself");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log("guard-imports: OK");
