import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import importX from "eslint-plugin-import-x";

// `defineConfig` from eslint/config, not `tseslint.config` — the latter is deprecated in
// typescript-eslint 8.68 now that ESLint core provides the same helper.
// https://typescript-eslint.io/packages/typescript-eslint/#config-deprecated
//
// Layering is NOT enforced here. Engineering_Standards.txt:133 offers eslint-plugin-boundaries or
// dependency-cruiser; the plugin's v7 element classification did not match this repo's layout
// (every cross-layer import resolved as "unknown", so the rule passed everything), and a gate that
// never fires is worse than no gate. .dependency-cruiser.cjs owns the layer graph and is verified
// to reject each violation class.

export default defineConfig(
  // Engineering_Standards.txt:25 — standards apply to first-party platform source. Local machine
  // tooling and the spec corpus are exempt via explicit ignore paths, not informal agreement.
  globalIgnores([
    "node_modules/**",
    "coverage/**",
    "**/*.d.ts",
    ".claude/**",
    ".research/**",
    ".graphify/**",
    ".superpowers/**",
    ".worktrees/**",
  ]),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // The two config files below are outside tsconfig's `include` by design; without this the
        // project service refuses to parse them at all.
        projectService: { allowDefaultProject: ["eslint.config.js", ".dependency-cruiser.cjs"] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { "import-x": importX },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-ignore": true,
          "ts-nocheck": true,
          "ts-expect-error": "allow-with-description",
          minimumDescriptionLength: 20,
        },
      ],
      "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "never" }],
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "import-x/no-default-export": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSEnumDeclaration",
          message: "enum is banned — use a const union (Engineering Standards §2.1).",
        },
      ],
      "max-lines": ["warn", { max: 300, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["warn", { max: 40, skipBlankLines: true, skipComments: true }],
      complexity: ["warn", 10],
      "max-depth": ["warn", 3],
      "max-params": ["warn", 3],
    },
  },
  {
    // Two exceptions the standard names for `as`: test fixtures, and the single brand constructor
    // every branded type is built through. A path list of individual parsers was the previous
    // approach and it broke silently the first time a file moved folders.
    //
    // A test is the composition root for the unit under test, so it is also the one place a lower
    // layer may reach an adapter — the layering rules still bind every non-test file.
    files: [
      "**/*.test.ts",
      "tests/**/*.ts",
      "src/primitives/domain/language/brand.ts",
      "src/evidence/infrastructure/parse-stored-entry.ts",
    ],
    rules: { "@typescript-eslint/consistent-type-assertions": "off" },
  },
  {
    // `brand`'s caller-chosen return type is the assertion, which is what the rule is detecting.
    // Keeping it caller-chosen is the whole design: it is what makes the carrier type checked.
    files: ["src/primitives/domain/language/brand.ts"],
    rules: { "@typescript-eslint/no-unnecessary-type-parameters": "off" },
  },
  {
    files: ["eslint.config.js", "scripts/**/*.ts"],
    rules: { "import-x/no-default-export": "off" },
  },
  {
    files: ["**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { module: "readonly", require: "readonly", __dirname: "readonly" },
    },
  },
);
