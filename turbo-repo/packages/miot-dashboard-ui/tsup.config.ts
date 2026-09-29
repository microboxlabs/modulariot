import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/core.ts", "src/client.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  splitting: true,
  platform: "neutral",
  target: "es2022",
});
