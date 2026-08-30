import { expect, test } from "bun:test";

/**
 * Engineering_Standards.txt:30-60 — "this is the floor, not a starting point for negotiation".
 * Loosening the config is a rollback of the standard, so it fails a test rather than passing
 * silently in a pull request nobody reads closely.
 */
const REQUIRED_COMPILER_OPTIONS: Readonly<Record<string, boolean | string>> = {
  strict: true,
  noUncheckedIndexedAccess: true,
  exactOptionalPropertyTypes: true,
  noPropertyAccessFromIndexSignature: true,
  noImplicitReturns: true,
  noImplicitOverride: true,
  noFallthroughCasesInSwitch: true,
  noUnusedLocals: true,
  noUnusedParameters: true,
  allowUnreachableCode: false,
  allowUnusedLabels: false,
  verbatimModuleSyntax: true,
  isolatedModules: true,
  noUncheckedSideEffectImports: true,
  moduleDetection: "force",
  forceConsistentCasingInFileNames: true,
  erasableSyntaxOnly: true,
  declaration: true,
  declarationMap: true,
  sourceMap: true,
  skipLibCheck: true,
};

/** Parse boundary: JSON arrives as `unknown` and is narrowed once, here. */
function readProperty(source: object, name: string): unknown {
  const descriptor: PropertyDescriptor | undefined = Object.getOwnPropertyDescriptor(source, name);
  return descriptor === undefined ? undefined : descriptor.value;
}

function readCompilerOptions(parsed: unknown): object {
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("tsconfig.base.json did not parse to an object");
  }
  const options = readProperty(parsed, "compilerOptions");
  if (typeof options !== "object" || options === null) {
    throw new Error("tsconfig.base.json has no compilerOptions object");
  }
  return options;
}

test("tsconfig.base.json declares every mandated compiler option", async () => {
  const parsed: unknown = await Bun.file(new URL("../tsconfig.base.json", import.meta.url)).json();
  const compilerOptions = readCompilerOptions(parsed);

  for (const [option, expected] of Object.entries(REQUIRED_COMPILER_OPTIONS)) {
    expect([option, readProperty(compilerOptions, option)]).toEqual([option, expected]);
  }
});
