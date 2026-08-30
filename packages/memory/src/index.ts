export type {
  MemoryCategory,
  MemoryEntry,
  Provenance,
  WritePolicy,
  WriteVerdict,
} from "./domain/memory-entry";
export { DEFAULT_WRITE_POLICY, mayPersist } from "./domain/memory-entry";
export type { RecallInput, RecallWeights } from "./domain/recall";
export {
  DEFAULT_RECALL_WEIGHTS,
  FACT_EXPIRY_DAYS,
  isStale,
  MEMORY_RETENTION_DAYS,
  scoreRecall,
} from "./domain/recall";
