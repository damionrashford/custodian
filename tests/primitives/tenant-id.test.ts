import { expect, test } from "bun:test";
import { parseTenantId } from "@custodian/primitives";

test("a well-formed tenant id parses", () => {
  const parsed = parseTenantId("t_01jd7k9h2m4n6p8r0s2t4v6x8z");
  expect(parsed.ok).toBe(true);
});

test("a malformed tenant id is returned as an error, not thrown", () => {
  const parsed = parseTenantId("acme-corp");
  expect(parsed).toEqual({
    ok: false,
    error: { kind: "invalid-tenant-id", received: "acme-corp" },
  });
});
