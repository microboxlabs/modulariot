#!/usr/bin/env node
/**
 * Import guard for @microboxlabs/miot-dashboard-contract.
 *
 * One rule, and the package's whole reason to exist: it depends on neither
 * half. Somebody implementing the server in another runtime, or writing a
 * client against it, installs this and gets the contract — not a renderer, not
 * a Node service, and nothing either of those needed.
 *
 * So the shipped code may import `zod` and its own siblings, and nothing else.
 * Not `react`, not the UI or server packages, and no `node:` builtin either:
 * this is imported by browser bundles as well as servers, and a builtin that
 * compiles here fails in half the places it ships to.
 *
 * Tests and scripts are held to a looser list, because neither is published.
 *
 * Run as part of `check-types`, so a violation fails CI rather than review.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * Every module specifier in a file, across all import forms:
 *   from "x" · export … from "x" · import "x" · import("x") · require("x")
 *
 * Matched against the specifier rather than the line, so a dynamic or
 * side-effect import cannot slip past a gate whose whole job is to stop one.
 * `\s` matches newlines, so a specifier may sit on a line of its own.
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
 * Comments, removed before anything is matched.
 *
 * Prose quotes things. A docstring explaining a 403 reason contains the words
 * `from "you are in the scope but may not do this"`, and to a regex that is an
 * import of a module with a long name — this guard reported exactly that
 * before it stripped comments.
 *
 * Tracked with a scanner rather than a regex because the failure directions
 * are not symmetric: mistaking prose for code is noise, while mistaking code
 * for a comment hides the import this exists to catch. So string literals and
 * their escapes are followed properly, and only what is left is scanned.
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
        // Newlines are kept so that nothing downstream sees two statements
        // joined into one line.
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
