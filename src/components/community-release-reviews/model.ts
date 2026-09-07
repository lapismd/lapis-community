import type {
  RegistryReleaseInspectionState,
  RegistryReleaseReviewEntry,
} from "../../registry/index.js";

export interface CommunityReleaseReviewGroups {
  pending: readonly RegistryReleaseReviewEntry[];
  reviewed: readonly RegistryReleaseReviewEntry[];
  blocked: readonly RegistryReleaseReviewEntry[];
}

const reviewedStates = new Set<RegistryReleaseInspectionState>([
  "approved",
  "rejected",
  "revoked",
  "withdrawn",
]);

export function groupCommunityReleaseReviews(
  entries: readonly RegistryReleaseReviewEntry[],
): CommunityReleaseReviewGroups {
  return {
    pending: entries.filter((entry) => entry.inspection.state === "pending"),
    reviewed: entries.filter((entry) =>
      reviewedStates.has(entry.inspection.state),
    ),
    blocked: entries.filter(
      (entry) =>
        entry.inspection.state === "untrusted" ||
        entry.inspection.state === "invalid" ||
        entry.inspection.state === "unavailable",
    ),
  };
}
