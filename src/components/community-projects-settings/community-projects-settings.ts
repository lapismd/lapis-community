import type { ProjectForgeRepositoryCapabilities } from "../../projects/model.js";
import type { OwnersDocument } from "../../projects/owners.js";

export function repositoryProtectionSummary(
  capabilities: ProjectForgeRepositoryCapabilities | undefined,
): {
  defaultBranch: string;
  protectedRef: string;
  pullRequestsRequired: boolean;
  mergeActors: string;
  githubAuthoritative: boolean;
} {
  const protection = capabilities?.protection;
  return {
    defaultBranch: protection?.default_branch || "HEAD",
    protectedRef: protection?.protected_ref || "HEAD",
    pullRequestsRequired: protection?.pull_requests_required !== false,
    mergeActors:
      protection?.merge_actors ||
      (protection?.github_authoritative
        ? "GitHub"
        : "channel maintainers and administrators"),
    githubAuthoritative: protection?.github_authoritative === true,
  };
}

export function ownersSummary(document: OwnersDocument | undefined): string {
  if (!document || document.rules.length === 0) {
    return "No extra OWNERS.md path reviewers are in effect. Channel maintainers still review and merge.";
  }
  return document.rules
    .map((rule) => `${rule.path} → ${rule.pubkeys.join(", ")}`)
    .join("\n");
}
