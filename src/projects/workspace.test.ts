import { describe, expect, it } from "vitest";

import type { NostrEvent } from "../protocol/index.js";
import {
  PROJECT_FORGE_KINDS,
  type ProjectForgeCatalog,
  type ProjectForgeWorkItems,
} from "./model.js";
import { materializeProjectForgeCatalog } from "./reducer.js";
import {
  buildProjectForgeActivity,
  projectForgeChildChannels,
} from "./workspace.js";

const owner = "1".repeat(64);
const repositoryCoordinate = `${PROJECT_FORGE_KINDS.repository}:${owner}:notes`;

function event(
  id: string,
  kind: number,
  createdAt: number,
  tags: string[][],
  content = "",
): NostrEvent {
  return {
    id: id.repeat(64).slice(0, 64),
    kind,
    pubkey: owner,
    created_at: createdAt,
    tags,
    content,
    sig: "f".repeat(128),
  };
}

describe("project workspace projection", () => {
  it("projects every unique bound channel, including the project home channel", () => {
    const catalog = materializeProjectForgeCatalog([
      event("1", PROJECT_FORGE_KINDS.project, 10, [
        ["d", "notes"],
        ["buzz-channel", "home"],
        ["buzz-related-channel", "planning"],
        ["buzz-related-channel", "home"],
        ["buzz-related-channel", "planning"],
        ["a", repositoryCoordinate],
      ]),
      event("2", PROJECT_FORGE_KINDS.repository, 11, [
        ["d", "notes"],
        ["buzz-channel", "development"],
      ]),
    ]);

    expect(catalog.projects[0]?.relatedChannelIds).toEqual(["planning"]);
    expect(
      projectForgeChildChannels(catalog.projects[0]!, catalog.repositories),
    ).toEqual([
      { channelId: "home", role: "home" },
      { channelId: "planning", role: "related" },
      {
        channelId: "development",
        repositoryCoordinate,
        role: "related",
      },
    ]);
  });

  it("builds deterministic newest-first activity from catalog and work items", () => {
    const catalog = materializeProjectForgeCatalog([
      event("1", PROJECT_FORGE_KINDS.project, 10, [
        ["d", "notes"],
        ["name", "Notes"],
        ["a", repositoryCoordinate],
      ]),
      event("2", PROJECT_FORGE_KINDS.repository, 11, [
        ["d", "notes"],
        ["name", "notes-desktop"],
      ]),
    ]);
    const workItems: ProjectForgeWorkItems = {
      tasks: [
        {
          root: event("3", PROJECT_FORGE_KINDS.task, 12, [
            ["a", repositoryCoordinate],
            ["subject", "Prepare beta"],
          ]),
          repository: catalog.repositories[0]!.address,
          title: "Prepare beta",
          content: "Coordinate the release",
          labels: [],
          lifecycle: "open",
          assignees: [],
          activity: [
            {
              event: event(
                "4",
                PROJECT_FORGE_KINDS.note,
                13,
                [["e", "3".repeat(64)]],
                "Ready to test",
              ),
              encoding: "buzz-kind-1",
              assignees: [],
            },
          ],
          createdAt: 12,
          updatedAt: 13,
        },
      ],
      pullRequests: [],
      events: [],
    };

    const activity = buildProjectForgeActivity(
      catalog as ProjectForgeCatalog,
      workItems,
    );
    expect(activity.map((item) => item.kind)).toEqual([
      "comment",
      "task",
      "repository",
      "project",
    ]);
    expect(activity[0]).toMatchObject({
      action: "commented on a task in",
      title: "Prepare beta",
      projectCoordinate: catalog.projects[0]!.address.coordinate,
    });
  });

  it("projects trusted review requests and decision labels into activity", () => {
    const catalog = materializeProjectForgeCatalog([
      event("1", PROJECT_FORGE_KINDS.project, 10, [
        ["d", "notes"],
        ["name", "Notes"],
        ["a", repositoryCoordinate],
      ]),
      event("2", PROJECT_FORGE_KINDS.repository, 11, [
        ["d", "notes"],
        ["name", "notes-desktop"],
      ]),
    ]);
    const root = event(
      "3",
      PROJECT_FORGE_KINDS.pullRequest,
      20,
      [["a", repositoryCoordinate]],
      "Ready for review",
    );
    const approval = event(
      "4",
      PROJECT_FORGE_KINDS.note,
      21,
      [["e", root.id]],
      "Looks good",
    );
    const request = event(
      "5",
      PROJECT_FORGE_KINDS.note,
      22,
      [["e", root.id]],
      "Review requested",
    );
    const workItems: ProjectForgeWorkItems = {
      tasks: [],
      pullRequests: [
        {
          root,
          repository: catalog.repositories[0]!.address,
          title: "Prepare beta",
          content: root.content,
          labels: [],
          recipients: [],
          initialCommit: "a".repeat(40),
          currentCommit: "a".repeat(40),
          cloneUrls: [],
          branchName: "beta",
          targetBranch: "main",
          mergeBase: "b".repeat(40),
          lifecycle: "open",
          mergeCommit: "",
          mergeReferences: [],
          reviewers: [owner],
          approvals: [],
          changeRequests: [],
          updates: [],
          lifecycleEvents: [],
          comments: [
            {
              event: approval,
              encoding: "buzz-kind-1",
              commit: "a".repeat(40),
              isInlineComment: false,
              isReviewRequest: false,
              isTrustedReviewRequest: false,
              reviewerPubkeys: [],
              decision: "approved",
              isTrustedDecision: true,
              decisionStatus: "current",
              reactions: [],
            },
            {
              event: request,
              encoding: "buzz-kind-1",
              commit: "a".repeat(40),
              isInlineComment: false,
              isReviewRequest: true,
              isTrustedReviewRequest: true,
              reviewerPubkeys: [owner],
              isTrustedDecision: false,
              reactions: [],
            },
          ],
          createdAt: root.created_at,
          updatedAt: request.created_at,
        },
      ],
      events: [root, approval, request],
    };

    const activity = buildProjectForgeActivity(
      catalog as ProjectForgeCatalog,
      workItems,
    );

    expect(activity.slice(0, 3).map((item) => item.kind)).toEqual([
      "review-request",
      "approval",
      "review",
    ]);
    expect(activity[0]).toMatchObject({ action: "requested review in" });
    expect(activity[1]).toMatchObject({
      action: "approved a review in",
      detail: "Approved",
    });
  });
});
