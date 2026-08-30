/** Token counts for one completion. Shared so metering can price without importing the gateway. */
export type CompletionUsage = {
  readonly inputTokens: number;
  readonly outputTokens: number;
};
