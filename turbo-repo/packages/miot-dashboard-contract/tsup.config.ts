import { defineConfig } from "tsup";

export default defineConfig({
  // One entry per subject, no root barrel: importing the role vocabulary must
  // not load zod.
  entry: ["src/document.ts", "src/schema.ts", "src/roles.ts", "src/errors.ts"],
  format: ["esm"],
  outDir: "dist",
  dts: true,
  clean: true,
  // Without this, shared types land in both `document.js` and `schema.js`.
  splitting: true,
  // Neutral, not node: browser bundles import this too.
  platform: "neutral",
  target: "es2022",
});
