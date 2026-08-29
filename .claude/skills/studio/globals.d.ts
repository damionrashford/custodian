// Ambient declarations for the studio skill's Bun-runtime scripts.
// No package.json / node_modules / @types installs (per stack-conventions.md).
//
// tsconfig.json provides ESNext + DOM lib for the standard web globals
// (console, fetch, URL, AbortSignal, setTimeout, ...). This file only
// declares the Bun/Node specifics those libs don't cover.

declare const Bun: any;
declare const Buffer: any;
declare const process: {
  exit(code?: number): never;
  argv: string[];
  env: Record<string, string | undefined>;
  cwd(): string;
  platform: string;
  arch: string;
  pid: number;
  [k: string]: any;
};

// node: builtins — bun resolves these at runtime.
declare module "node:fs" {
  export const readFileSync: any;
  export const writeFileSync: any;
  export const existsSync: any;
  export const renameSync: any;
  export const mkdirSync: any;
  export const statSync: any;
  export const readdirSync: any;
  export const appendFileSync: any;
  export const unlinkSync: any;
  export const rmSync: any;
  export const mkdtempSync: any;
  export const copyFileSync: any;
  const _default: any;
  export default _default;
}
declare module "node:fs/promises" {
  export const mkdir: any;
  export const readFile: any;
  export const writeFile: any;
  const _default: any;
  export default _default;
}
declare module "node:path" {
  export const join: any;
  export const resolve: any;
  export const dirname: any;
  export const basename: any;
  export const extname: any;
  export const sep: any;
  export const normalize: any;
  const _default: any;
  export default _default;
}
declare module "node:os" {
  export const homedir: any;
  export const tmpdir: any;
  const _default: any;
  export default _default;
}
declare module "node:url" {
  export const fileURLToPath: any;
  export const pathToFileURL: any;
  const _default: any;
  export default _default;
}
declare module "node:crypto" {
  export const randomUUID: any;
  export const createHash: any;
  const _default: any;
  export default _default;
}

// Bare-specifier modules resolved from the workspace node_modules (or Bun
// auto-install when the skill runs standalone).
declare module "ajv/dist/2020.js" {
  const x: any;
  export default x;
}
declare module "ajv-formats" {
  const x: any;
  export default x;
}
declare module "unpdf" {
  export const getDocumentProxy: any;
  export const extractText: any;
  const _default: any;
  export default _default;
}
declare module "css-tree" {
  export const parse: any;
  export const walk: any;
  export const generate: any;
  const _default: any;
  export default _default;
}
declare module "node-html-parser" {
  export const parse: any;
  export const valid: any;
  const _default: any;
  export default _default;
}
declare module "sharp" {
  const x: any;
  export default x;
}
declare module "playwright" {
  export const chromium: any;
  const _default: any;
  export default _default;
}

// Bun adds these to import.meta.
interface ImportMeta {
  dir: string;
  url: string;
  path: string;
  file: string;
  main: boolean;
}

// bun:test — ambient decl for IDE only; bun resolves natively at runtime.
declare module "bun:test" {
  export const test: any;
  export const expect: any;
  export const describe: any;
  export const beforeAll: any;
  export const afterAll: any;
}
