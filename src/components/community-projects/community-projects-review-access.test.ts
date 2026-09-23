import { describe, expect, it } from "vitest";

import {
  canMergeSelectedPullRequest,
  canReviewSelectedPullRequest,
} from "./community-projects-review-access.js";

const pullRequest = {
  root: { pubkey: "author" },
  lifecycle: "open" as const,
  approvals: [{ reviewer: "author" }],
};

describe("community project review access", () => {
  it("hides review for ordinary maintainer authors and allows owner or admin authors", () => {
    const shared = {
      canCollaborate: true,
      canMaintain: true,
      lifecycle: "open" as const,
      actor: "author",
      author: "author",
    };
    expect(canReviewSelectedPullRequest(shared)).toBe(false);
    expect(
      canReviewSelectedPullRequest({
        ...shared,
        repositoryOwner: "author",
      }),
    ).toBe(true);
    expect(
      canReviewSelectedPullRequest({
        ...shared,
        isAdmin: true,
      }),
    ).toBe(true);
    expect(
      canReviewSelectedPullRequest({
        ...shared,
        actor: "maintainer",
      }),
    ).toBe(true);
  });

  it("does not treat author approvals as merge-eligible unless admin bypass applies", () => {
    expect(
      canMergeSelectedPullRequest({
        canCollaborate: true,
        canMaintain: true,
        mergeAdvertised: true,
        pullRequest,
      }),
    ).toBe(false);
    expect(
      canMergeSelectedPullRequest({
        canCollaborate: true,
        canMaintain: true,
        mergeAdvertised: true,
        isAdmin: true,
        adminBypass: true,
        pullRequest,
      }),
    ).toBe(true);
    expect(
      canMergeSelectedPullRequest({
        canCollaborate: true,
        canMaintain: true,
        mergeAdvertised: true,
        isAdmin: false,
        adminBypass: true,
        pullRequest,
      }),
    ).toBe(false);
  });
});
