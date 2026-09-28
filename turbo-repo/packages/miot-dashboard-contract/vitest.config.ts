import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      reporter: [
        ["lcov", { projectRoot: fileURLToPath(new URL("../../", import.meta.url)) }],
        "text-summary",
      ],
    },
  },
});
