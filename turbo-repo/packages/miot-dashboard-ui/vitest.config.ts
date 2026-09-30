import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@microboxlabs/miot-dashboard-ui/document": fileURLToPath(
        new URL("./src/document.ts", import.meta.url),
      ),
    },
  },
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
