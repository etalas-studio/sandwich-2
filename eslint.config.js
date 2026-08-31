import tseslint from "typescript-eslint";
import boundaries from "eslint-plugin-boundaries";

export default tseslint.config(
  { ignores: ["dist/", "node_modules/", "apps/web/", "poc/", "config/"] },
  tseslint.configs.recommended,
  {
    files: ["apps/server/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // Clean Architecture layer boundary enforcement
  // Applies only to layer directories (created in Task 2); no-op until then.
  {
    files: [
      "apps/server/domain/**/*.ts",
      "apps/server/application/**/*.ts",
      "apps/server/infrastructure/**/*.ts",
    ],
    plugins: { boundaries },
    settings: {
      "boundaries/elements": [
        { type: "domain",         pattern: "apps/server/domain/*" },
        { type: "application",   pattern: "apps/server/application/*" },
        { type: "infrastructure", pattern: "apps/server/infrastructure/*" },
        { type: "shared",        pattern: ["apps/server/*.ts", "apps/server/db/connection.ts"] },
      ],
    },
    rules: {
      "boundaries/element-types": ["error", {
        default: "disallow",
        rules: [
          { from: "domain",         allow: ["domain", "shared"] },
          { from: "application",    allow: ["application", "domain", "shared"] },
          { from: "infrastructure", allow: ["infrastructure", "application", "domain", "shared"] },
          { from: "shared",         allow: ["shared"] },
        ],
      }],
    },
  },
);
