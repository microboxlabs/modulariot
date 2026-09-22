#!/usr/bin/env node
/**
 * Import guard. Shipped code may import `zod` and its own siblings, and
 * nothing else — no `node:` builtin either, since browsers import this.
 * Tests and scripts use a looser list. Runs as part of `check-types`.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** What the published bundle may reach for. */
const SHIPPED_ALLOWED = new Set(["zod"]);

/** Additionally allowed in tests and build scripts, which are not published. */
const TOOLING_ALLOWED = new Set([
  "vitest",
  "yaml",
  "typescript",
  "zod-to-json-schema",
  "node:fs",
  "node:path",
  "node:url",
]);

/**
 * Every module specifier, from TypeScript's own lexer rather than a regex over
 * the text. It follows comments and every literal form, including the
 * template-literal `import(`x`)` a regex silently lets through.
 */
export function specifiersIn(source) {
  return ts
    .preProcessFile(source, true, true)
    .importedFiles.map((file) => file.fileName);
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

export function problemsUnder(root = ROOT) {
  const problems = [];
  for (const directory of ["src", "scripts"]) {
    for (const file of walk(join(root, directory))) {
      const isTooling = directory === "scripts" || /\.test\.ts$/.test(file);
      const allowed = isTooling
        ? new Set([...SHIPPED_ALLOWED, ...TOOLING_ALLOWED])
        : SHIPPED_ALLOWED;
      for (const specifier of specifiersIn(readFileSync(file, "utf8"))) {
        if (isRelative(specifier) || allowed.has(specifier)) continue;
        problems.push(
          `${relative(root, file)}: imports "${specifier}", which ${
            isTooling
              ? "is not on the tooling allow-list"
              : "the published contract may not depend on"
          }`,
        );
      }
    }
  }
  return problems;
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (invokedDirectly) {
  const problems = problemsUnder();
  if (problems.length > 0) {
    console.error("guard-imports: the contract reached outside itself");
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  console.log("guard-imports: OK");
}
