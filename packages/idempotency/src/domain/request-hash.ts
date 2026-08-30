import { type Brand, err, ok, type Result } from "@custodian/domain-primitives";

export type RequestHash = Brand<string, "RequestHash">;

export type InvalidRequestHash = {
  readonly kind: "invalid-request-hash";
  readonly received: string;
};

const REQUEST_HASH_PATTERN = /^[0-9a-f]{64}$/;

export function parseRequestHash(value: string): Result<RequestHash, InvalidRequestHash> {
  return REQUEST_HASH_PATTERN.test(value)
    ? ok(value as RequestHash)
    : err({ kind: "invalid-request-hash", received: value });
}
