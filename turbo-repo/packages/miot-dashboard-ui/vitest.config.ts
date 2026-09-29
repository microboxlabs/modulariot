import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "src/**/*.tsx"],
      reporter: [
        ["lcov", { projectRoot: fileURLToPath(new URL("../../", import.meta.url)) }],
        "text-summary",
      ],
    },
  },
});
