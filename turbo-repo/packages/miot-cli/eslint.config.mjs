import { config as baseConfig } from "@repo/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...baseConfig,
  {
    rules: {
      "turbo/no-undeclared-env-vars": [
        "warn",
        {
          allowList: [
            "MIOT_BASE_URL",
            "MIOT_TOKEN",
            "MIOT_HARNESS_BASE_URL",
            "MIOT_HARNESS_TOKEN",
          ],
        },
      ],
    },
  },
  {
    ignores: ["dist/**", "node_modules/**"],
  },
];
