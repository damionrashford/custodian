import type { ProviderId } from "@custodian/domain-primitives";
import type { Region } from "@custodian/domain-primitives";

/**
 * Storage location and processing location are recorded separately because they are independent
 * facts and a single "EU" claim conflates them (Data_Protection_and_Retention.txt:143). A provider
 * that stores in region but processes elsewhere is not in region.
 */
export type ProviderProfile = {
  readonly id: ProviderId;
  readonly processingRegion: Region;
  readonly storageRegion: Region;
  readonly zeroRetention: boolean;
  readonly healthy: boolean;
};
