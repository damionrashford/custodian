import { brand } from "@custodian/primitives";
import type { Brand } from "@custodian/primitives";

export type UntrustedText = Brand<string, "UntrustedText">;

export type ProvenancedContent = {
  readonly provenance: "tool-output";
  readonly trust: "untrusted";
  readonly text: UntrustedText;
};

/* eslint-disable no-control-regex --
   Matching control characters is this module's entire purpose: it strips them out of untrusted
   tool output. The rule exists to catch them appearing by accident. */

// Built from escape strings rather than character-class literals on purpose: a regex holding raw
// invisible characters is unreviewable in a diff, which is a poor property for a security control.
const ANSI_SEQUENCES = new RegExp("\\u001B\\[[0-9;]*[A-Za-z]", "gu");
// C0/C1 control characters other than tab, newline and carriage return.
const CONTROL_CHARACTERS = new RegExp(
  "[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F]",
  "gu",
);
// Zero-width spaces, directional marks, bidi overrides and isolates — the characters that let
// injected text render as something other than what a classifier scored.
const INVISIBLE_CHARACTERS = new RegExp(
  "[\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2064\\u2066-\\u2069\\uFEFF]",
  "gu",
);

/**
 * The MCP reference SDK implements neither server-side output sanitisation nor client-side result
 * validation despite the specification requiring both, so this is the platform's responsibility
 * (AI_Agent_Implementation_Plan_v2.txt:77). The provenance tag is equally load-bearing: external
 * content must never be treated as equivalent to authenticated user input in a memory write
 * decision (Data_Protection_and_Retention.txt:160-161).
 */
export function sanitizeToolOutput(raw: string): ProvenancedContent {
  const stripped = raw
    .replaceAll(ANSI_SEQUENCES, "")
    .replaceAll(CONTROL_CHARACTERS, "")
    .replaceAll(INVISIBLE_CHARACTERS, "");
  return { provenance: "tool-output", trust: "untrusted", text: brand<UntrustedText>(stripped) };
}
