import { rmSync } from "node:fs";
import { defineConfig, type Options } from "tsup";

export default defineConfig((options) => {
  // Clean once before either build starts; neither watcher deletes its sibling.
  if (!options.watch)
    rmSync(new URL("./dist", import.meta.url), {
      recursive: true,
      force: true,
    });
  const shared: Options = {
    format: ["esm"],
    dts: true,
    clean: false,
    platform: "neutral",
    target: "es2022",
  };
  return [
    {
      ...shared,
      entry: ["src/browser.ts"],
      outDir: "dist/browser",
      platform: "browser",
      splitting: false,
      noExternal: [/.*/],
      minify: true,
      define: { "process.env.NODE_ENV": '"production"' },
    },
    {
      ...shared,
      entry: [
        "src/core.ts",
        "src/client.ts",
        "src/document.ts",
        "src/templates.ts",
      ],
      splitting: true,
    },
    {
      ...shared,
      entry: ["src/react.ts", "src/embed.ts", "src/web-component.ts"],
      splitting: false,
      external: ["react", "react-dom/client", "@microboxlabs/miot-dashboard-ui/document"],
      banner: { js: '"use client";' },
    },
  ];
});
