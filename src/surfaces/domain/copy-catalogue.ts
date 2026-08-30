import type { Surface } from "./vocabulary";

/**
 * Article 50 disclosure.
 *
 * Perceivable in the interaction surface itself, at first contact, in the same visual weight as
 * other primary text — not a tooltip, a footer, or a settings page
 * (Design_Interface_Standards.txt:26-37). A vague "assistant" reference or a mention in terms and
 * conditions does not discharge the duty, and a deployer cannot rely on the provider's marking to
 * discharge theirs.
 *
 * Versioned because the copy is a design-reviewed artefact jointly owned with Legal, and because a
 * deployment needs to be able to say which wording was shown on a given date.
 */
export type Disclosure = {
  readonly version: string;
  readonly primary: string;
  readonly secondary: string;
};

export const DISCLOSURE: Disclosure = {
  version: "a50-2026-08-30",
  primary: "An AI agent is asking to act.",
  secondary: "It cannot proceed until a person decides.",
};

/**
 * An error a person will read. Three fields because the corpus reviews error strings as a set and
 * requires each to carry all three (:316-330) — a message naming the cause without the cost leaves
 * the reader to go and check, and one without a next action leaves them stuck.
 */
export type ErrorCopy = {
  readonly cause: string;
  readonly cost: string;
  readonly nextAction: string;
};

export type CopyEntry = {
  readonly surface: Surface;
  readonly text: string;
};

/**
 * Every user-facing string, in one place.
 *
 * Not inline, because a string in a template cannot be reviewed as a set, translated, or checked
 * against the lexicon for the surface it appears on (:308-315). This is the catalogue the
 * banned-lexicon gate reads.
 */
export const COPY: Readonly<Record<string, CopyEntry>> = {
  "approval.title": { surface: "approval", text: "Waiting on you" },
  "approval.empty": { surface: "approval", text: "Nothing is waiting for a decision." },
  "approval.approve": { surface: "approval", text: "Approve and run" },
  "approval.reject": { surface: "approval", text: "Reject" },
  "approval.scope": {
    surface: "approval",
    text: "You are approving this one action, not the whole run. The assistant will ask again for anything else that cannot be undone.",
  },
  "approval.irreversible": {
    surface: "approval",
    text: "This cannot be undone. No copy is kept of what it replaces.",
  },
  "approval.deadline": {
    surface: "approval",
    text: "After the time above, this is refused automatically and nothing happens.",
  },
  "state.queued": { surface: "end-user", text: "Waiting to start" },
  "state.thinking": { surface: "end-user", text: "Working out what to do" },
  "state.acting": { surface: "end-user", text: "Doing it" },
  "state.awaiting-approval": { surface: "end-user", text: "Waiting for a person to decide" },
  "state.streaming": { surface: "end-user", text: "Writing the answer" },
  "state.recovering": { surface: "end-user", text: "Trying again" },
  "state.failed": { surface: "end-user", text: "Stopped before finishing" },
};

/**
 * The error set, reviewed together rather than one at a time.
 *
 * Read them in a row: each says what happened, what it cost, and the one thing to do next. Reading
 * them as a set is how you notice that three of them said "try again" and only one of them meant it.
 */
export const ERRORS: Readonly<Record<string, ErrorCopy>> = {
  "run.halted": {
    cause: "The assistant stopped before finding an answer.",
    cost: "Nothing was changed on your behalf.",
    nextAction: "Ask again with more detail.",
  },
  "run.refused-residency": {
    cause: "This request cannot be handled in your region.",
    cost: "Nothing was sent and nothing was charged.",
    nextAction: "Contact your administrator about where your data may be processed.",
  },
  "run.already-served": {
    cause: "This request was already submitted.",
    cost: "The original answer is shown below; you were not charged twice.",
    nextAction: "Use the answer, or start a new request.",
  },
  "approval.denied-rejected": {
    cause: "A reviewer declined this action.",
    cost: "Nothing was changed.",
    nextAction: "Ask the reviewer what they would approve instead.",
  },
  "approval.denied-timeout": {
    cause: "This action needed approval and nobody was available to give it.",
    cost: "Nothing was changed.",
    nextAction: "Ask again when a reviewer is available.",
  },
  "tool.too-long": {
    cause: "The task ran too long and was stopped.",
    cost: "Anything it finished before stopping is listed above.",
    nextAction: "Narrow what you asked for and try again.",
  },
};
