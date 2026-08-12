// ESLint flat config (v9+). Adapted from bidding-tictactoe/web/eslint.config.mjs
// with the Astro-specific parts dropped — this kit is vanilla TS with no
// framework, so there is no .astro surface to lint.
import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import globals from "globals";

export default [
  { ignores: ["dist", "node_modules", "coverage"] },
  js.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-undef": "off", // TS already handles this; the DOM/WebRTC globals confuse eslint.
    },
  },
  {
    // Plain-JS helpers: the build's asset-copy script and the test-relay
    // server (shipped to dist/ unbuilt, so it must lint as itself).
    files: ["scripts/**/*.mjs", "src/test-relay.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
];
