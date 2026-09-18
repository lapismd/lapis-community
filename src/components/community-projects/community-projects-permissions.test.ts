import { describe, expect, it } from "vitest";

import {
  canMergeMaintainedPullRequest,
  mergeDenialReason,
} from "./community-projects-permissions.js";

const pullRequest = {
  root: { pubkey: "author" },
  lifecycle: "open" as const,
  approvals: [{ reviewer: "maintainer" }],
};

describe("community project permissions", () => {
  it("denies merge without CanMaintain or advertised merge", () => {
    expect(
      mergeDenialReason({
        canCollaborate: true,
        canMaintain: false,
        mergeAdvertised: true,
        pullRequest,
      }),
    ).toMatch(/maintainer/i);
    expect(
      canMergeMaintainedPullRequest({
        canCollaborate: true,
        canMaintain: true,
        mergeAdvertised: false,
        pullRequest,
      }),
    ).toBe(false);
    expect(
      canMergeMaintainedPullRequest({
        canCollaborate: true,
        canMaintain: true,
        mergeAdvertised: true,
        pullRequest,
      }),
    ).toBe(true);
  });
});
