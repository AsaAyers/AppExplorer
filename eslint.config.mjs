import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import noRelativeImportPaths from "eslint-plugin-no-relative-import-paths";

const eslintConfig = defineConfig([
  ...nextVitals.map((config) => {
    if (config.name === "next") {
      return {
        ...config,
        rules: {
          ...config.rules,
          "import/enforce-node-protocol-usage": ["warn", "always"],
          "import/no-nodejs-modules": ["off"],
          "import/no-duplicates": ["error", { "prefer-inline": true }],
          "import/order": [
            "warn",
            {
              alphabetize: { order: "asc" },
              "newlines-between": "always",
            },
          ],
        },
      };
    }

    return config;
  }),
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    "app-explorer.cjs",
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  js.configs.recommended,
  {
    // files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    // languageOptions: {
    //   ecmaVersion: "latest",
    //   sourceType: "module",
    // },
    plugins: {
      "no-relative-import-paths": noRelativeImportPaths,
    },
    rules: {
      "no-relative-import-paths/no-relative-import-paths": [
        "error",
        {
          allowSameFolder: false,
          rootDir: "src",
          prefix: "@",
        },
      ],
      "no-console": ["error", { allow: ["error"] }],
      "no-unused-vars": ["off"],

      "no-undef": "off",
      "no-restricted-globals": ["error"],
      "@typescript-eslint/no-explicit-any": ["off"],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          // args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^(_|log\\b)",
          ignoreRestSiblings: true,
          enableAutofixRemoval: {
            imports: true,
          },
        },
      ],
      "no-restricted-syntax": [
        "off",
        {
          selector: "TSAsExpression > TSNeverKeyword",
          message: "Avoid using 'as never'.",
        },
      ],
    },
  },
]);

export default eslintConfig;
