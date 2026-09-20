import { defineConfig } from "tsup";

export default defineConfig({
  // One entry per subject, and no root entry that re-exports them. A host that
  // wants only the role vocabulary — an access layer, a proxy mapping its own
  // roles onto ours — should not load zod to get it, and with a barrel it
  // would.
  entry: ["src/document.ts", "src/schema.ts", "src/roles.ts", "src/errors.ts"],
  format: ["esm"],
  outDir: "dist",
  dts: true,
  clean: true,
  // Shared types would otherwise be emitted into both `document.js` and
  // `schema.js`, giving a consumer that imports each two copies of the same
  // declarations.
  splitting: true,
  // Neutral, not node: this package is imported by browser bundles too, and
  // it reaches for nothing platform-specific.
  platform: "neutral",
  target: "es2022",
});
