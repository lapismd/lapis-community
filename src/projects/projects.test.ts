import { describe, expect, it } from "vitest";

import type { NostrEvent } from "../protocol/index.js";
import {
  addRepositoryToProjectTemplate,
  createDeletionTemplate,
  createProjectReactionTemplate,
  createProjectTaskAnchorTemplate,
  createProjectTemplate,
  createPullRequestTemplate,
  createPullRequestReviewTemplate,
  createReviewDecisionTemplate,
  createTaskTemplate,
  updateProjectTemplate,
} from "./builders.js";
import { buzzWorkItemFilters, parseSseResult } from "./data-source.js";
import { PROJECT_FORGE_KINDS } from "./model.js";
import {
  materializeProjectForgeCatalog,
  materializeProjectForgeWorkItems,
  reduceProjectTask,
  reducePullRequest,
} from "./reducer.js";

const owner = "1".repeat(64);
const author = "2".repeat(64);
const reviewer = "3".repeat(64);
const outsider = "4".repeat(64);
const repositoryCoordinate = `${PROJECT_FORGE_KINDS.repository}:${owner}:notes`;
const commitA = "a".repeat(40);
const commitB = "b".repeat(64);

function event(
  id: string,
  kind: number,
  pubkey: string,
  createdAt: number,
  tags: string[][],
  content = "",
): NostrEvent {
  return {
    id: id.repeat(64).slice(0, 64),
    kind,
    pubkey,
    created_at: createdAt,
    tags,
    content,
    sig: "f".repeat(128),
  };
}

const repository = event("9", PROJECT_FORGE_KINDS.repository, owner, 1, [
  ["d", "notes"],
  ["name", "Notes"],
  ["buzz-channel", "notes-dev"],
]);

describe("project forge builders", () => {
  it("labels submitted pull request reviews for provider projection", () => {
    const root = event("1", PROJECT_FORGE_KINDS.pullRequest, author, 2, [
      ["a", repositoryCoordinate],
      ["subject", "Review me"],
      ["c", commitA],
    ]);

    expect(
      createPullRequestReviewTemplate(
        root,
        repositoryCoordinate,
        "comment",
        commitA,
        "Looks good overall.",
        3,
      ),
    ).toMatchObject({
      kind: PROJECT_FORGE_KINDS.note,
      created_at: 3,
      content: "Looks good overall.",
      tags: expect.arrayContaining([
        ["e", root.id, "", "root"],
        ["a", repositoryCoordinate],
        ["c", commitA],
        ["t", "review-comment"],
      ]),
    });
  });

  it("creates a NIP-25 reaction with an exact project comment target", () => {
    const comment = event("6", PROJECT_FORGE_KINDS.note, reviewer, 3, [
      ["e", "1".repeat(64), "", "root"],
      ["a", repositoryCoordinate],
    ]);
    expect(
      createProjectReactionTemplate(comment, repositoryCoordinate, "🚀", 4),
    ).toEqual({
      kind: PROJECT_FORGE_KINDS.reaction,
      created_at: 4,
      content: "🚀",
      tags: [
        ["e", comment.id],
        ["p", reviewer],
        ["k", String(PROJECT_FORGE_KINDS.note)],
        ["a", repositoryCoordinate],
      ],
    });
  });

  it("creates a project without eagerly creating or referencing a repository", () => {
    expect(
      createProjectTemplate(
        {
          identifier: "notes",
          name: "Notes",
          channelId: "notes-dev",
        },
        10,
      ),
    ).toEqual({
      kind: PROJECT_FORGE_KINDS.project,
      created_at: 10,
      content: "",
      tags: [
        ["d", "notes"],
        ["name", "Notes"],
        ["buzz-channel", "notes-dev"],
      ],
    });
  });

  it("persists only Buzz unlisted intent and leaves listed projects tagless", () => {
    expect(
      createProjectTemplate({
        identifier: "hidden",
        name: "Hidden",
        channelId: "private-work",
        listing: "unlisted",
      }).tags,
    ).toContainEqual(["buzz-visibility", "unlisted"]);
    expect(
      createProjectTemplate({
        identifier: "listed",
        name: "Listed",
        channelId: "public-work",
        listing: "listed",
      }).tags.some((tag) => tag[0] === "buzz-visibility"),
    ).toBe(false);
  });

  it("creates a lazy task anchor and avoids a real repository collision", () => {
    const project = event("8", PROJECT_FORGE_KINDS.project, owner, 1, [
      ["d", "notes"],
      ["name", "Notes"],
      ["buzz-channel", "notes-dev"],
    ]);
    const result = createProjectTaskAnchorTemplate(
      project,
      [
        {
          address: {
            kind: PROJECT_FORGE_KINDS.repository,
            owner,
            identifier: "notes",
            coordinate: repositoryCoordinate,
          },
          repositoryClass: "hosted",
        },
      ],
      11,
    );
    expect(result.coordinate).toBe(
      `${PROJECT_FORGE_KINDS.repository}:${owner}:notes-project-tasks`,
    );
    expect(result.template.tags).toContainEqual([
      "project-task-anchor",
      "true",
    ]);
    expect(
      result.template.tags.some(
        (tag) => tag[0] === "clone" || tag[0] === "web",
      ),
    ).toBe(false);
  });

  it("updates editable project settings while preserving its address and extensions", () => {
    const project = event("8", PROJECT_FORGE_KINDS.project, owner, 1, [
      ["d", "notes"],
      ["name", "Notes"],
      ["description", "Old description"],
      ["buzz-channel", "notes-dev"],
      ["buzz-visibility", "unlisted"],
      ["buzz-related-channel", "notes-support"],
      ["x-extension", "preserve-me"],
    ]);

    expect(
      updateProjectTemplate(
        project,
        {
          name: "Notes Desktop",
          description: "Updated description",
          channelId: "notes-private",
          listing: "listed",
        },
        12,
      ),
    ).toEqual({
      kind: PROJECT_FORGE_KINDS.project,
      created_at: 12,
      content: "",
      tags: [
        ["d", "notes"],
        ["buzz-related-channel", "notes-support"],
        ["x-extension", "preserve-me"],
        ["name", "Notes Desktop"],
        ["description", "Updated description"],
        ["buzz-channel", "notes-private"],
      ],
    });
  });

  it("replaces direct channel attachments without changing project extensions", () => {
    const project = event("8", PROJECT_FORGE_KINDS.project, owner, 1, [
      ["d", "notes"],
      ["name", "Notes"],
      ["buzz-channel", "notes-dev"],
      ["buzz-related-channel", "notes-support"],
      ["buzz-related-channel", "notes-design"],
      ["x-extension", "preserve-me"],
    ]);

    expect(
      updateProjectTemplate(
        project,
        {
          name: "Notes",
          description: "",
          channelId: "notes-dev",
          listing: "unlisted",
          relatedChannelIds: ["notes-design"],
        },
        12,
      ).tags,
    ).toEqual([
      ["d", "notes"],
      ["x-extension", "preserve-me"],
      ["name", "Notes"],
      ["buzz-channel", "notes-dev"],
      ["buzz-visibility", "unlisted"],
      ["buzz-related-channel", "notes-design"],
    ]);
  });

  it("preserves project extension tags when a repository is added", () => {
    const project = event("8", PROJECT_FORGE_KINDS.project, owner, 1, [
      ["d", "notes"],
      ["name", "Notes"],
      ["x-extension", "preserve-me"],
    ]);
    const template = addRepositoryToProjectTemplate(
      project,
      repositoryCoordinate,
      "wss://relay.example",
      2,
    );
    expect(template.tags).toContainEqual(["x-extension", "preserve-me"]);
    expect(template.tags).toContainEqual([
      "a",
      repositoryCoordinate,
      "wss://relay.example",
    ]);
  });

  it("builds Buzz-compatible task and pull-request roots", () => {
    expect(
      createTaskTemplate(
        {
          repository: repositoryCoordinate,
          repositoryOwner: owner,
          title: "Ship beta",
          content: "Coordinate launch",
        },
        2,
      ).kind,
    ).toBe(PROJECT_FORGE_KINDS.task);
    const pullRequest = createPullRequestTemplate(
      {
        repository: repositoryCoordinate,
        repositoryOwner: owner,
        title: "Add editor",
        content: "Ready for review",
        commit: commitB,
        cloneUrls: ["https://relay.example/git/notes"],
        reviewers: [reviewer],
      },
      3,
    );
    expect(pullRequest.tags).toContainEqual(["c", commitB]);
    expect(pullRequest.tags).toContainEqual([
      "clone",
      "https://relay.example/git/notes",
    ]);
  });

  it("rejects abbreviated commits and accepts full SHA-1 and SHA-256 IDs", () => {
    expect(() =>
      createPullRequestTemplate({
        repository: repositoryCoordinate,
        repositoryOwner: owner,
        title: "Bad",
        content: "",
        commit: "abc123",
        cloneUrls: ["https://relay.example/git/notes"],
      }),
    ).toThrow(/full SHA-1 or SHA-256/u);
    expect(() =>
      createPullRequestTemplate({
        repository: repositoryCoordinate,
        repositoryOwner: owner,
        title: "Good",
        content: "",
        commit: commitA,
        cloneUrls: ["https://relay.example/git/notes"],
      }),
    ).not.toThrow();
  });
});

describe("project forge reducers", () => {
  it("defaults absent and unknown listing values to listed", () => {
    const listed = event("8", PROJECT_FORGE_KINDS.project, owner, 1, [
      ["d", "listed"],
      ["name", "Listed"],
    ]);
    const unknown = event("7", PROJECT_FORGE_KINDS.project, owner, 1, [
      ["d", "unknown"],
      ["name", "Unknown"],
      ["buzz-visibility", "private"],
    ]);
    const unlisted = event("6", PROJECT_FORGE_KINDS.project, owner, 1, [
      ["d", "unlisted"],
      ["name", "Unlisted"],
      ["buzz-visibility", "unlisted"],
    ]);
    const projects = materializeProjectForgeCatalog([
      listed,
      unknown,
      unlisted,
    ]).projects;
    expect(
      Object.fromEntries(
        projects.map((project) => [project.name, project.listing]),
      ),
    ).toEqual({
      Listed: "listed",
      Unknown: "listed",
      Unlisted: "unlisted",
    });
  });

  it("selects replaceable project events by newest timestamp and smallest same-second ID", () => {
    const older = event("c", PROJECT_FORGE_KINDS.project, owner, 1, [
      ["d", "notes"],
      ["name", "Old"],
    ]);
    const larger = event("b", PROJECT_FORGE_KINDS.project, owner, 2, [
      ["d", "notes"],
      ["name", "Larger"],
    ]);
    const smaller = event("a", PROJECT_FORGE_KINDS.project, owner, 2, [
      ["d", "notes"],
      ["name", "Smaller"],
    ]);
    expect(
      materializeProjectForgeCatalog([older, larger, smaller]).projects[0]
        ?.name,
    ).toBe("Smaller");
  });

  it("hides an address only after an owner-authored tombstone", () => {
    const project = event("8", PROJECT_FORGE_KINDS.project, owner, 1, [
      ["d", "notes"],
      ["name", "Notes"],
    ]);
    const outsiderDelete = event(
      "7",
      PROJECT_FORGE_KINDS.deletion,
      outsider,
      2,
      [["a", `${PROJECT_FORGE_KINDS.project}:${owner}:notes`]],
    );
    const ownerDelete = event("6", PROJECT_FORGE_KINDS.deletion, owner, 2, [
      ["a", `${PROJECT_FORGE_KINDS.project}:${owner}:notes`],
    ]);
    expect(
      materializeProjectForgeCatalog([project, outsiderDelete]).projects,
    ).toHaveLength(1);
    expect(
      materializeProjectForgeCatalog([project, ownerDelete]).projects,
    ).toHaveLength(0);
  });

  it("reduces task status and Buzz assignments deterministically", () => {
    const root = event("1", PROJECT_FORGE_KINDS.task, author, 2, [
      ["a", repositoryCoordinate],
      ["subject", "Ship"],
    ]);
    const assigned = event("2", PROJECT_FORGE_KINDS.note, author, 3, [
      ["e", root.id, "", "root"],
      ["a", repositoryCoordinate],
      ["p", reviewer],
      ["t", "assignment"],
    ]);
    const close = event("f", PROJECT_FORGE_KINDS.statusClosed, owner, 4, [
      ["e", root.id, "", "root"],
      ["a", repositoryCoordinate],
    ]);
    const state = reduceProjectTask(root, repository, [assigned, close]);
    expect(state.lifecycle).toBe("closed");
    expect(state.assignees).toEqual([reviewer]);
    expect(state.activity[0]?.encoding).toBe("buzz-kind-1");
  });

  it("matches Buzz tie directions and keeps old decisions historical", () => {
    const root = event("1", PROJECT_FORGE_KINDS.pullRequest, author, 2, [
      ["a", repositoryCoordinate],
      ["p", owner],
      ["p", reviewer],
      ["subject", "Editor"],
      ["c", commitA],
      ["clone", "https://relay.example/git/notes"],
    ]);
    const updateLarge = event(
      "e",
      PROJECT_FORGE_KINDS.pullRequestUpdate,
      author,
      3,
      [
        ["a", repositoryCoordinate],
        ["p", owner],
        ["E", root.id],
        ["P", author],
        ["c", commitB],
        ["clone", "https://relay.example/git/notes"],
      ],
    );
    const updateSmall = event(
      "d",
      PROJECT_FORGE_KINDS.pullRequestUpdate,
      author,
      3,
      [
        ["a", repositoryCoordinate],
        ["p", owner],
        ["E", root.id],
        ["P", author],
        ["c", commitA],
        ["clone", "https://relay.example/git/notes"],
      ],
    );
    const oldDecisionTemplate = createReviewDecisionTemplate(
      root,
      repositoryCoordinate,
      "approved",
      commitB,
      "",
      4,
    );
    const decisionSmall = event(
      "3",
      oldDecisionTemplate.kind,
      reviewer,
      4,
      oldDecisionTemplate.tags,
    );
    const decisionLarge = event(
      "4",
      oldDecisionTemplate.kind,
      reviewer,
      4,
      oldDecisionTemplate.tags.map((tag) =>
        tag[0] === "t" ? ["t", "changes-requested"] : tag,
      ),
    );
    const state = reducePullRequest(root, repository, [
      updateLarge,
      updateSmall,
      decisionSmall,
      decisionLarge,
    ]);
    expect(state.currentCommit).toBe(commitA);
    expect(state.changeRequests).toHaveLength(0);
    expect(state.approvals).toHaveLength(0);
    expect(
      state.comments.every(
        (comment) => comment.decisionStatus === "historical",
      ),
    ).toBe(true);
  });

  it("retains trusted pull request lifecycle history in chronological order", () => {
    const root = event("1", PROJECT_FORGE_KINDS.pullRequest, author, 2, [
      ["a", repositoryCoordinate],
      ["p", owner],
      ["subject", "Editor"],
      ["c", commitA],
      ["clone", "https://relay.example/git/notes"],
    ]);
    const closed = event("2", PROJECT_FORGE_KINDS.statusClosed, owner, 5, [
      ["e", root.id, "", "root"],
      ["a", repositoryCoordinate],
    ]);
    const reopened = event("3", PROJECT_FORGE_KINDS.statusOpen, owner, 6, [
      ["e", root.id, "", "root"],
      ["a", repositoryCoordinate],
    ]);
    const merged = event("4", PROJECT_FORGE_KINDS.statusMerged, owner, 7, [
      ["e", root.id, "", "root"],
      ["a", repositoryCoordinate],
      ["merge-commit", commitB],
      ["r", commitB],
    ]);
    const untrusted = event(
      "5",
      PROJECT_FORGE_KINDS.statusClosed,
      outsider,
      8,
      [
        ["e", root.id, "", "root"],
        ["a", repositoryCoordinate],
      ],
    );

    const state = reducePullRequest(root, repository, [
      merged,
      untrusted,
      closed,
      reopened,
    ]);
    expect(state.lifecycle).toBe("merged");
    expect(state.lifecycleEvents.map((entry) => entry.lifecycle)).toEqual([
      "closed",
      "open",
      "merged",
    ]);
    expect(state.lifecycleEvents[2]?.mergeCommit).toBe(commitB);
  });

  it("trusts only requested reviewers and keeps invalid inline anchors visible", () => {
    const root = event("1", PROJECT_FORGE_KINDS.pullRequest, author, 2, [
      ["a", repositoryCoordinate],
      ["p", owner],
      ["p", reviewer],
      ["subject", "Editor"],
      ["c", commitA],
      ["clone", "https://relay.example/git/notes"],
    ]);
    const approval = event("5", PROJECT_FORGE_KINDS.note, reviewer, 4, [
      ["e", root.id, "", "root"],
      ["a", repositoryCoordinate],
      ["t", "approval"],
      ["c", commitA],
    ]);
    const outsiderApproval = event("6", PROJECT_FORGE_KINDS.note, outsider, 5, [
      ["e", root.id, "", "root"],
      ["a", repositoryCoordinate],
      ["t", "approval"],
      ["c", commitA],
    ]);
    const invalidInline = event(
      "7",
      PROJECT_FORGE_KINDS.note,
      reviewer,
      6,
      [
        ["e", root.id, "", "root"],
        ["a", repositoryCoordinate],
        ["t", "inline-comment"],
        ["file", "../secret"],
        ["side", "new"],
        ["line", "1"],
      ],
      "Please adjust this",
    );
    const state = reducePullRequest(root, repository, [
      approval,
      outsiderApproval,
      invalidInline,
    ]);
    expect(state.approvals.map((entry) => entry.reviewer)).toEqual([reviewer]);
    const projected = state.comments.find(
      (comment) => comment.event.id === invalidInline.id,
    );
    expect(projected?.isInlineComment).toBe(true);
    expect(projected?.anchor).toBeUndefined();
  });

  it("groups visible pull request comment reactions and marks the current author", () => {
    const root = event("1", PROJECT_FORGE_KINDS.pullRequest, author, 2, [
      ["a", repositoryCoordinate],
      ["p", owner],
      ["subject", "Editor"],
      ["c", commitA],
      ["clone", "https://relay.example/git/notes"],
    ]);
    const comment = event("2", PROJECT_FORGE_KINDS.note, reviewer, 3, [
      ["e", root.id, "", "root"],
      ["a", repositoryCoordinate],
      ["c", commitA],
    ]);
    const selectedReaction = event(
      "3",
      PROJECT_FORGE_KINDS.reaction,
      author,
      4,
      [
        ["e", comment.id],
        ["p", reviewer],
        ["k", String(PROJECT_FORGE_KINDS.note)],
        ["a", repositoryCoordinate],
      ],
      "👍",
    );
    const otherReaction = event(
      "4",
      PROJECT_FORGE_KINDS.reaction,
      outsider,
      5,
      selectedReaction.tags,
      "👍",
    );
    const removedReaction = event(
      "5",
      PROJECT_FORGE_KINDS.reaction,
      author,
      6,
      selectedReaction.tags,
      "🎉",
    );
    const deletionTemplate = createDeletionTemplate(removedReaction, 7);
    const deletion = event(
      "6",
      deletionTemplate.kind,
      author,
      deletionTemplate.created_at,
      deletionTemplate.tags,
    );
    const state = materializeProjectForgeWorkItems(
      repository,
      [
        root,
        comment,
        selectedReaction,
        otherReaction,
        removedReaction,
        deletion,
      ],
      author,
    );
    expect(state.pullRequests[0]?.comments[0]?.reactions).toEqual([
      { emoji: "👍", count: 2, selected: true },
    ]);
  });
});

describe("Buzz transport compatibility", () => {
  it("uses the six repository-scoped 2,000-event query filters", () => {
    const filters = buzzWorkItemFilters(repositoryCoordinate);
    expect(filters).toHaveLength(6);
    expect(
      filters.every(
        (filter) =>
          filter.limit === 2_000 && filter["#a"]?.[0] === repositoryCoordinate,
      ) && filters.at(-1)?.kinds?.[0] === 3901,
    ).toBe(true);
  });

  it("reads progress and the terminal result from WalGit SSE", () => {
    const progress: string[] = [];
    const result = parseSseResult<{ ok: boolean }>(
      'event: progress\ndata: {"message":"walking objects"}\n\nevent: result\ndata: {"ok":true}\n\n',
      (entry) => progress.push(entry.message),
    );
    expect(progress).toEqual(["walking objects"]);
    expect(result).toEqual({ ok: true });
  });
});
