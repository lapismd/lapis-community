import { describe, expect, it } from "vitest";

import type { NostrEvent } from "../protocol/index.js";
import { maintainersAuthority } from "./authority.js";
import { PROJECT_FORGE_KINDS } from "./model.js";
import { reducePullRequest } from "./reducer.js";
import {
  allowsAuthorReviewDecision,
  trustsReviewDecision,
} from "./review-trust.js";

const owner = "1".repeat(64);
const reviewer = "3".repeat(64);
const admin = "2".repeat(64);
const repositoryCoordinate = `${PROJECT_FORGE_KINDS.repository}:${owner}:notes`;
const commit = "a".repeat(40);

function event(
  id: string,
  kind: number,
  pubkey: string,
  createdAt: number,
  tags: string[][],
): NostrEvent {
  return {
    id: id.repeat(64).slice(0, 64),
    kind,
    pubkey,
    created_at: createdAt,
    tags,
    content: "",
    sig: "f".repeat(128),
  };
}

const repository = event("9", PROJECT_FORGE_KINDS.repository, owner, 1, [
  ["d", "notes"],
  ["name", "Notes"],
  ["buzz-channel", "notes-dev"],
]);

describe("allowsAuthorReviewDecision", () => {
  it("exempts the 30617 owner and administrators, not ordinary maintainers", () => {
    const maintainOnly = {
      canMaintain: (pubkey: string) => pubkey === owner || pubkey === reviewer,
      isAdmin: () => false,
    };
    expect(
      allowsAuthorReviewDecision({
        signer: reviewer,
        author: admin,
        repositoryOwner: owner,
      }),
    ).toBe(true);
    expect(
      allowsAuthorReviewDecision({
        signer: owner,
        author: owner,
        repositoryOwner: owner,
      }),
    ).toBe(true);
    expect(
      allowsAuthorReviewDecision({
        signer: admin,
        author: admin,
        repositoryOwner: owner,
        isAdmin: true,
      }),
    ).toBe(true);
    expect(
      allowsAuthorReviewDecision({
        signer: reviewer,
        author: reviewer,
        repositoryOwner: owner,
      }),
    ).toBe(false);
    expect(trustsReviewDecision(owner, owner, owner, maintainOnly)).toBe(true);
    expect(trustsReviewDecision(reviewer, reviewer, owner, maintainOnly)).toBe(
      false,
    );
    expect(
      trustsReviewDecision(admin, admin, owner, maintainersAuthority([admin])),
    ).toBe(true);
  });
});

describe("pull request review trust", () => {
  it("trusts a 30617 owner author review and ignores a maintainer author review", () => {
    const maintainOnly = {
      canMaintain: (pubkey: string) => pubkey === owner || pubkey === reviewer,
      isAdmin: () => false,
    };
    const ownerRoot = event("1", PROJECT_FORGE_KINDS.pullRequest, owner, 2, [
      ["a", repositoryCoordinate],
      ["subject", "Owned"],
      ["c", commit],
    ]);
    const ownerApproval = event("2", PROJECT_FORGE_KINDS.note, owner, 3, [
      ["e", ownerRoot.id, "", "root"],
      ["a", repositoryCoordinate],
      ["t", "approval"],
      ["c", commit],
    ]);
    const ownerState = reducePullRequest(
      ownerRoot,
      repository,
      [ownerApproval],
      undefined,
      maintainOnly,
    );
    expect(ownerState.approvals.map((entry) => entry.reviewer)).toEqual([
      owner,
    ]);
    expect(
      ownerState.comments.find(
        (comment) => comment.event.id === ownerApproval.id,
      )?.isTrustedDecision,
    ).toBe(true);

    const maintainerRoot = event(
      "3",
      PROJECT_FORGE_KINDS.pullRequest,
      reviewer,
      4,
      [
        ["a", repositoryCoordinate],
        ["subject", "Maintained"],
        ["c", commit],
      ],
    );
    const maintainerApproval = event(
      "4",
      PROJECT_FORGE_KINDS.note,
      reviewer,
      5,
      [
        ["e", maintainerRoot.id, "", "root"],
        ["a", repositoryCoordinate],
        ["t", "approval"],
        ["c", commit],
      ],
    );
    const maintainerState = reducePullRequest(
      maintainerRoot,
      repository,
      [maintainerApproval],
      undefined,
      maintainOnly,
    );
    expect(maintainerState.approvals).toEqual([]);
    expect(
      maintainerState.comments.find(
        (comment) => comment.event.id === maintainerApproval.id,
      )?.isTrustedDecision,
    ).toBe(false);
  });
});
