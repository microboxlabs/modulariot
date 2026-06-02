import { nextJsConfig } from "@repo/eslint-config/next-js";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "*.js",
      "public/**",
    ],
  },
  ...nextJsConfig,
  {
    // i18n safety: keep tr() statically type-checked against the dictionary by
    // forbidding non-literal keys. Runtime-built keys must use trDynamic(). The
    // i18n module itself is exempt: its internal `_tr` forwards an already
    // TrKey-typed `path` to `tr`.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/features/i18n/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            'CallExpression[callee.name="tr"][arguments.0.type!="Literal"][arguments.0.type!="TemplateLiteral"]',
          message:
            "i18n: tr() keys must be a string or template literal so they are type-checked against the dictionary. For a key built at runtime, use trDynamic() instead.",
        },
      ],
    },
  },
];
