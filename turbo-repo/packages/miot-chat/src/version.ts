import { createRequire } from "node:module";

// Resolves ../package.json relative to this module. Works from both
// src/ (vitest) and tsup's flat dist/ output because each sits one
// level under the package root — if the dist layout ever gains
// nesting, this lookup breaks.
export function packageVersion(): string {
  const require = createRequire(import.meta.url);
  const pkg = require("../package.json") as { version: string };
  return pkg.version;
}
