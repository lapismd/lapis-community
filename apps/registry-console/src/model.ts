import type { RegistryProvenance } from "./types.js";

export interface ProvenanceSummary {
  accepted: number;
  excluded: number;
  issues: number;
}

export function summarizeProvenance(
  provenance: RegistryProvenance,
): ProvenanceSummary {
  return {
    accepted: provenance.acceptedEventIds.length,
    excluded: Object.values(provenance.exclusionCounts).reduce(
      (total, count) => total + count,
      0,
    ),
    issues: provenance.issues.length,
  };
}

export function shortHex(value: string, width = 10): string {
  if (value.length <= width * 2 + 1) return value;
  return `${value.slice(0, width)}…${value.slice(-width)}`;
}
