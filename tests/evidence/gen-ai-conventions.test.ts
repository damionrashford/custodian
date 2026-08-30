import { expect, test } from "bun:test";
import { GEN_AI_ATTRIBUTE, GEN_AI_CONVENTIONS_PIN } from "@custodian/evidence";

test("the pinned attribute names transcribe the adopted convention snapshot", () => {
  // The pin is the deliverable (AI_Agent_Implementation_Plan_v2.txt:262): the conventions are
  // pre-stable and names churn — gen_ai.system has already become gen_ai.provider.name — so what
  // Custodian emits changes only when this test is deliberately edited (the LD-9 pattern).
  expect(GEN_AI_ATTRIBUTE).toEqual({
    operationName: "gen_ai.operation.name",
    providerName: "gen_ai.provider.name",
    requestModel: "gen_ai.request.model",
    responseModel: "gen_ai.response.model",
    usageInputTokens: "gen_ai.usage.input_tokens",
    usageOutputTokens: "gen_ai.usage.output_tokens",
  });
  expect(GEN_AI_CONVENTIONS_PIN).toBe("otel-gen_ai/development@2026-08-29");
});

test("no content-bearing attribute is pinned — telemetry is metadata-only", () => {
  const names: readonly string[] = Object.values(GEN_AI_ATTRIBUTE);
  const contentBearing = [
    "gen_ai.input.messages",
    "gen_ai.output.messages",
    "gen_ai.system_instructions",
    "gen_ai.prompt",
    "gen_ai.completion",
  ];
  for (const banned of contentBearing) {
    expect(names).not.toContain(banned);
  }
});
