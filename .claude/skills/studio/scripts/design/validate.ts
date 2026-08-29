#!/usr/bin/env bun
/**
 * validate.ts — Validate design.json or a draft against design-system.schema.json (via ajv).
 *
 * Usage:
 *   bun validate.ts --brand design/design.json
 *   bun validate.ts --draft design/drafts/from-url-...json
 *   bun validate.ts --brand design/design.json --schema ~/.claude/skills/brand-identity-system/assets/design-system.schema.json
 *
 * Exit codes: 0 valid · 2 invalid (stderr lists errors) · 1 IO error.
 */

import { Ajv2020, addFormats } from "../../lib/vendor/ajv2020.mjs";
import { readFileSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";

const argv = Bun.argv.slice(2);
const args: { brand?: string; draft?: string; schema?: string } = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--brand") args.brand = argv[++i];
  else if (a === "--draft") args.draft = argv[++i];
  else if (a === "--schema") args.schema = argv[++i];
  else if (a === "-h" || a === "--help") {
    console.log("Usage: bun validate.ts --brand <path> | --draft <path> [--schema <path>]");
    process.exit(0);
  }
}

const target = args.brand ?? args.draft;
if (!target) { console.error("Either --brand or --draft is required"); process.exit(2); }
const targetPath = resolve(target);
if (!existsSync(targetPath)) { console.error(`File not found: ${targetPath}`); process.exit(1); }

// Default to the skill's bundled schema if --schema not provided.
const defaultSchemaPath = resolve(import.meta.dir, "..", "..", "assets", "design-system.schema.json");
const schemaPath = args.schema ? resolve(args.schema) : defaultSchemaPath;
if (!existsSync(schemaPath)) { console.error(`Schema not found: ${schemaPath}`); process.exit(1); }

let data, schema;
try {
  data = JSON.parse(readFileSync(targetPath, "utf-8"));
  schema = JSON.parse(readFileSync(schemaPath, "utf-8"));
} catch (e) {
  console.error(`JSON parse failure: ${(e as Error).message}`);
  process.exit(1);
}

const ajv = new (Ajv2020 as any)({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);
const valid = validate(data);

if (valid) {
  console.log(JSON.stringify({ ok: true, file: targetPath, schema: schemaPath, schema_version: data.schema_version }, null, 2));
  process.exit(0);
} else {
  console.error(JSON.stringify({
    ok: false,
    file: targetPath,
    error_count: validate.errors?.length ?? 0,
    errors: (validate.errors ?? []).map(e => ({
      path: e.instancePath || "(root)",
      keyword: e.keyword,
      message: e.message,
      params: e.params
    }))
  }, null, 2));
  process.exit(2);
}
