/** How many model tokens a string occupies. Supplied by the caller, never assumed to be characters. */
export type TokenCounter = (text: string) => number;
