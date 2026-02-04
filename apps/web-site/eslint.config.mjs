import { nextJsConfig } from "@repo/eslint-config/next-js";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "public/**",
    ],
  },
  ...nextJsConfig,
];
