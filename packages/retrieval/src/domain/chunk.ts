export type Chunk = {
  readonly text: string;
  readonly startToken: number;
  readonly tokenCount: number;
};

/** How many model tokens a string occupies. Supplied by the caller — see chunk-recursive.ts. */
export type TokenCounter = (text: string) => number;
