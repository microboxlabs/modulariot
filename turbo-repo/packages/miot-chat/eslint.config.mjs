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
            "MIOT_CHAT_BASE_URL",
            "MIOT_CHAT_TOKEN",
            "MIOT_CHAT_TENANT_ID",
            "MIOT_CHAT_USER_ID",
            "MIOT_CHAT_MODE",
            "MIOT_CHAT_PROFILE",
            "NO_COLOR",
          ],
        },
      ],
    },
  },
  {
    ignores: ["dist/**", "node_modules/**"],
  },
];
