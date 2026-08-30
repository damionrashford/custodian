/**
 * How many model tokens a string occupies. Supplied by the caller, never assumed to be characters —
 * a character-based count silently under-reports for non-Latin scripts and code, which is how a
 * chunk or a context window ends up over budget.
 */
export type TokenCounter = (text: string) => number;
