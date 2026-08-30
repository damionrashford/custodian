/**
 * The audience a string is written for. Vocabulary is scoped by surface, not by product
 * (Design_Interface_Standards.txt:208-227): the same fact is written four ways, and a term that is
 * precise on the operator console is an obstacle on an approval screen someone opens on a phone.
 *
 * The test that settles disputes: can the reader take the correct action without knowing how the
 * system is built? If understanding the sentence requires knowing that a queue exists, it was
 * written from the wrong side of the screen.
 */
export type Surface = "operator-console" | "tenant-admin" | "approval" | "end-user";

export type LexiconViolation = {
  readonly term: string;
  readonly instead: string;
  readonly reason: "implementation-language" | "marketing-language" | "never-surfaced";
};

/**
 * Engineering vocabulary that leaked. Banned on every surface except the operator console, where
 * these are that audience's real working words — replacing them with softened equivalents would
 * make the console worse (:208-213).
 */
const IMPLEMENTATION: Readonly<Record<string, string>> = {
  webhook: "where we send updates",
  payload: "the update",
  "token budget": "your monthly usage limit",
  "vector store": "your documents",
  embedding: "your documents",
  idempotency: "this request was already submitted",
  "dead-letter": "updates we couldn't deliver",
  "prompt version": "the previous settings",
  "rate limit": "too many requests at once",
  throttled: "too many requests at once",
  guardrail: "the assistant stopped — this request isn't allowed",
  tenant: "your organisation",
  namespace: "your workspace",
  enqueued: "started — we'll notify you when it's done",
  undefined: "not set",
  "auth token": "your session",
  sandbox: "the task environment",
};

/**
 * Promotional register. Banned in-product on every surface including the console: a system that
 * praises itself while acting autonomously reads as evasive, and it costs credibility exactly
 * where credibility matters (:263-270).
 */
const MARKETING: Readonly<Record<string, string>> = {
  seamless: "say what happens",
  effortless: "say what happens",
  magical: "say what happens",
  revolutionary: "delete",
  "next-generation": "delete",
  supercharge: "use the plain verb",
  unlock: "use the plain verb",
  unleash: "use the plain verb",
  simply: "delete",
  effortlessly: "delete",
  oops: "state what failed and the next step",
  "something went wrong": "state what failed and the next step",
};

/**
 * Never surfaced anywhere, on any surface, to anyone.
 *
 * These are simultaneously a usability failure and an information-disclosure risk: an error naming
 * the internal service tells an attacker how the system is built (:261).
 */
const NEVER: readonly string[] = [
  "stack trace",
  "at Object.",
  "TypeError",
  "ReferenceError",
  "null pointer",
  "ECONNREFUSED",
  "502 upstream",
  "SQLITE_",
  "oklch(",
];

/**
 * Checks one user-facing string against the lexicon for its surface.
 *
 * Case-insensitive and substring-based on purpose. This is a lint, not a parser: a term smuggled
 * past it by casing is a term someone went out of their way to smuggle, and the gate's job is to
 * catch the unedited leak rather than to win an argument with a determined author.
 */
export function checkVocabulary(text: string, surface: Surface): readonly LexiconViolation[] {
  const haystack = text.toLowerCase();
  const found: LexiconViolation[] = [];

  for (const term of NEVER) {
    if (haystack.includes(term.toLowerCase())) {
      found.push({ term, instead: "never surface this", reason: "never-surfaced" });
    }
  }
  for (const [term, instead] of Object.entries(MARKETING)) {
    if (haystack.includes(term)) {
      found.push({ term, instead, reason: "marketing-language" });
    }
  }
  // The one scoped exemption, and it is the corpus's own: a platform engineer running the system
  // needs these words, and taking them away makes their console worse rather than kinder.
  if (surface !== "operator-console") {
    for (const [term, instead] of Object.entries(IMPLEMENTATION)) {
      if (haystack.includes(term)) {
        found.push({ term, instead, reason: "implementation-language" });
      }
    }
  }
  return found;
}
