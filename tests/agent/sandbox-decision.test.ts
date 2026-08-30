import { expect, test } from "bun:test";
import { sandboxDecision } from "@custodian/agent";

test("a microVM executor composes without acknowledgement", () => {
  expect(sandboxDecision({ isolation: "microvm", devMode: undefined })).toEqual({
    kind: "compose",
  });
});

test("a shared-kernel executor is refused outside development", () => {
  // "Shared-kernel containers are not defensible for untrusted agent code under SOC 2 or HIPAA"
  // (AI_Agent_Implementation_Plan_v2.txt:184). The container executor exists so the capability can
  // be built before a Linux host with KVM is available; this is what stops it shipping.
  const decision = sandboxDecision({ isolation: "shared-kernel", devMode: undefined });
  expect(decision.kind).toBe("refuse");
});

test("a shared-kernel executor composes only when acknowledged", () => {
  expect(sandboxDecision({ isolation: "shared-kernel", devMode: "1" })).toEqual({
    kind: "compose",
  });
});
