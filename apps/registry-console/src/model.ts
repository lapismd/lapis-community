import type { RegistryProvenance } from "./types.js";
import type { CommunityProjection, SecurityProjection } from "./types.js";

export interface ProvenanceSummary {
  accepted: number;
  excluded: number;
  issues: number;
}

export function summarizeCommunity(community: CommunityProjection): {
  ratings: number;
  reviews: number;
  reports: number;
} {
  return {
    ratings: community.ratingAggregates.reduce(
      (total, aggregate) => total + aggregate.count,
      0,
    ),
    reviews: community.reviews.length,
    reports: community.reports.length,
  };
}

export function summarizeSecurity(security: SecurityProjection): {
  blocked: number;
  warnings: number;
} {
  return {
    blocked: security.statuses.filter(
      (status) => status.enforcement === "block",
    ).length,
    warnings: security.statuses.filter(
      (status) => status.enforcement === "warn",
    ).length,
  };
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
