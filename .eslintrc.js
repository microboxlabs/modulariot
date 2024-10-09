module.exports = {
  env: {
    browser: true,
    es6: true,
  },
  extends: [
    "eslint:recommended",
    "airbnb/hooks",
    "plugin:react/recommended",
    "plugin:react/jsx-runtime",
    "plugin:prettier/recommended",
    "plugin:import/recommended",
    "next/core-web-vitals",
    "prettier",
  ],
  // Specifying Parser
  ignorePatterns: ["*.test.ts", "*.config.*"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["./tsconfig.json"],
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: "latest",
    sourceType: "module",
    overrides: [
      {
        files: ["**/*.ts", "**/*.tsx"],
        plugins: ["@typescript-eslint"],
        extends: [
          "plugin:@typescript-eslint/recommended",
          "plugin:@typescript-eslint/recommended-requiring-type-checking",
          "airbnb-typescript",
        ],
        parserOptions: {},
      },
    ],
  },
  // Configuring third-party plugins
  plugins: ["react", "@typescript-eslint"],
  // Resolve imports

  rules: {
    "linebreak-style": "off",
    "prettier/prettier": "error",
    "react-hooks/exhaustive-deps": "off",
    "react/prop-types": "error",
    "object-shorthand": "error",
    "@typescript-eslint/ban-types": [
      "error",
      {
        extendDefaults: true,
        types: {
          "{}": false,
        },
      },
    ],
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unsafe-assignment": "warn",
    "@typescript-eslint/no-unsafe-argument": "warn",
    "@typescript-eslint/no-unsafe-return": "warn",
    "@typescript-eslint/no-unsafe-call": "warn",
    "@typescript-eslint/restrict-template-expressions": "warn",
    "@typescript-eslint/no-unsafe-member-access": "warn",
    "@typescript-eslint/default-param-last": "warn",
    "no-console": "warn",
    "no-unused-vars": "off",
    "react/jsx-filename-extension": [1, { extensions: [".tsx", ".jsx"] }],
    "react/jsx-curly-brace-presence": [1, "never"],
    "@typescript-eslint/no-unused-vars": [
      "error", // or "error"
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      },
    ],
  },
};
