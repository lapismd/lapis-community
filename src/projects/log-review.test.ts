import { getPublicKey, generateSecretKey } from "nostr-tools/pure";
import { describe, expect, it } from "vitest";

import { logReviewBranchName, logReviewRequest } from "./log-review.js";

describe("logReviewBranchName", () => {
  const author = getPublicKey(generateSecretKey());
  const changeId = "ab".repeat(16);

  it("names the review ref from the author npub and change id", () => {
    expect(logReviewBranchName(author, changeId.toUpperCase())).toMatch(
      new RegExp(`^review/npub1[0-9a-z]+/${changeId}$`, "u"),
    );
  });

  it("builds the pull-request fields without creating a Git ref", () => {
    expect(
      logReviewRequest(
        {
          title: "Review the log change",
          content: "Please look",
          commit: "cd".repeat(20),
          changeId,
          targetBranch: "main",
        },
        author,
        "30617:ee".concat("ee".repeat(31), ":notes"),
      ).branchName,
    ).toBe(logReviewBranchName(author, changeId));
  });

  it("rejects a missing author or change id", () => {
    expect(() => logReviewBranchName("", changeId)).toThrow(/author/u);
    expect(() => logReviewBranchName(author, "abcd")).toThrow(/change id/u);
  });
});
