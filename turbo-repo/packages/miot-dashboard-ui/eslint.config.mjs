import { config as baseConfig } from "@repo/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...baseConfig,
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  {
    // scripts/ runs under Node (guard-imports.mjs), not the browser bundle
    files: ["scripts/**"],
    languageOptions: {
      globals: { console: "readonly", process: "readonly", URL: "readonly" },
    },
  },
  {
    // Underscore prefix marks intentional discards (rest-destructure omits,
    // unused args) — same convention the core logic used in apps/app.
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
];
