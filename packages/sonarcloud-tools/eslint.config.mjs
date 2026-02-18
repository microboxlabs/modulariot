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
            "SONAR_TOKEN",
            "GITHUB_REF",
            "CI_MERGE_REQUEST_IID",
            "SYSTEM_PULLREQUEST_PULLREQUESTID",
            "BITBUCKET_PR_ID",
          ],
        },
      ],
    },
  },
  {
    ignores: ["dist/**", "node_modules/**"],
  },
];
