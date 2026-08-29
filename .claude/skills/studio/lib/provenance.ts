/**
 * Provenance shape helpers. Every token must record its source — these
 * helpers guarantee consistent shape across extractors and merge passes.
 */

export type SourceType = "url-fast" | "url-rendered" | "screenshot" | "moodboard" | "manual" | "merged";
export type ExtractionMode = "fast" | "rendered";

export interface Provenance {
  source_type: SourceType;
  source_url: string | null;
  source_selector?: string | null;
  extraction_mode: ExtractionMode;
  extracted_at: string;
  extractor_pass: string;
  sources?: Provenance[];
  merge_strategy?: "confidence-weighted" | "highest-wins" | null;
  cluster_size?: number;
  [key: string]: any;
}

export function makeProvenance(opts: {
  source_type: SourceType;
  source_url?: string | null;
  source_selector?: string | null;
  extraction_mode?: ExtractionMode;
  extractor_pass: string;
  extra?: Partial<Provenance>;
}): Provenance {
  return {
    source_type: opts.source_type,
    source_url: opts.source_url ?? null,
    source_selector: opts.source_selector ?? null,
    extraction_mode: opts.extraction_mode ?? "fast",
    extracted_at: new Date().toISOString(),
    extractor_pass: opts.extractor_pass,
    ...(opts.extra ?? {})
  };
}
