import type { NostrEvent, NostrEventTemplate } from "../protocol/index.js";
import {
  PROJECT_FORGE_KINDS,
  eventAddress,
  firstTagValue,
  isFullCommitId,
  parseNostrAddress,
  type ProjectForgeRepository,
  type PullRequestDecisionKind,
  type PullRequestInlineAnchor,
} from "./model.js";

export interface CreateProjectInput {
  identifier: string;
  name: string;
  description?: string;
  channelId: string;
  visibility?: string;
}

export interface UpdateProjectInput {
  name: string;
  description?: string;
  channelId: string;
  visibility?: string;
}

export interface CreateRepositoryInput {
  identifier: string;
  name: string;
  description?: string;
  channelId: string;
  cloneUrls?: readonly string[];
  webUrls?: readonly string[];
}

export interface CreateTaskInput {
  repository: string;
  repositoryOwner: string;
  title: string;
  content: string;
  labels?: readonly string[];
  assignees?: readonly string[];
  parentEventId?: string;
}

export interface CreatePullRequestInput {
  repository: string;
  repositoryOwner: string;
  title: string;
  content: string;
  commit: string;
  cloneUrls: readonly string[];
  branchName?: string;
  targetBranch?: string;
  mergeBase?: string;
  originChannelId?: string;
  reviewers?: readonly string[];
  labels?: readonly string[];
}

export function createProjectTemplate(
  input: CreateProjectInput,
  createdAt = unixNow(),
): NostrEventTemplate {
  requiredText(input.identifier, "Project identifier", 1_024);
  requiredText(input.name, "Project name", 256);
  requiredText(input.channelId, "Project channel", 256);
  optionalText(input.description, "Project description", 2_048);
  optionalText(input.visibility, "Project visibility", 256);
  return {
    kind: PROJECT_FORGE_KINDS.project,
    created_at: createdAt,
    content: "",
    tags: [
      ["d", input.identifier],
      ["name", input.name],
      ...(input.description ? [["description", input.description]] : []),
      ["buzz-channel", input.channelId],
      ...(input.visibility ? [["buzz-visibility", input.visibility]] : []),
    ],
  };
}

export function updateProjectTemplate(
  project: NostrEvent,
  input: UpdateProjectInput,
  createdAt = unixNow(),
): NostrEventTemplate {
  if (
    project.kind !== PROJECT_FORGE_KINDS.project ||
    eventAddress(project) === undefined
  ) {
    throw new Error("Project settings require a kind 30621 project");
  }
  requiredText(input.name, "Project name", 256);
  requiredText(input.channelId, "Project channel", 256);
  optionalText(input.description, "Project description", 2_048);
  optionalText(input.visibility, "Project visibility", 256);
  const editableTags = new Set([
    "name",
    "description",
    "buzz-channel",
    "buzz-visibility",
  ]);
  return {
    kind: project.kind,
    created_at: createdAt,
    content: project.content,
    tags: [
      ...project.tags
        .filter((tag) => !editableTags.has(tag[0] ?? ""))
        .map((tag) => [...tag]),
      ["name", input.name],
      ...(input.description ? [["description", input.description]] : []),
      ["buzz-channel", input.channelId],
      ...(input.visibility ? [["buzz-visibility", input.visibility]] : []),
    ],
  };
}

export function createRepositoryTemplate(
  input: CreateRepositoryInput,
  createdAt = unixNow(),
): NostrEventTemplate {
  requiredText(input.identifier, "Repository identifier", 1_024);
  requiredText(input.name, "Repository name", 256);
  requiredText(input.channelId, "Repository channel", 256);
  const cloneUrls = distinctNonempty(input.cloneUrls ?? []);
  const webUrls = distinctNonempty(input.webUrls ?? []);
  return {
    kind: PROJECT_FORGE_KINDS.repository,
    created_at: createdAt,
    content: input.description ?? "",
    tags: [
      ["d", input.identifier],
      ["name", input.name],
      ...(input.description ? [["description", input.description]] : []),
      ["buzz-channel", input.channelId],
      ...(cloneUrls.length > 0 ? [["clone", ...cloneUrls]] : []),
      ...webUrls.map((url) => ["web", url]),
    ],
  };
}

export function createProjectTaskAnchorTemplate(
  project: NostrEvent,
  repositories: readonly Pick<
    ProjectForgeRepository,
    "address" | "repositoryClass"
  >[] = [],
  createdAt = unixNow(),
): { coordinate: string; template: NostrEventTemplate } {
  const projectAddress = eventAddress(project);
  if (project.kind !== PROJECT_FORGE_KINDS.project || !projectAddress) {
    throw new Error("A project task anchor requires a kind 30621 project");
  }
  const occupied = new Map(
    repositories
      .filter((repository) => repository.address.owner === project.pubkey)
      .map((repository) => [
        repository.address.identifier,
        repository.repositoryClass,
      ]),
  );
  let identifier = projectAddress.identifier;
  if (occupied.get(identifier) !== "task-anchor" && occupied.has(identifier)) {
    const base = `${identifier}-project-tasks`;
    identifier = base;
    for (let suffix = 2; occupied.has(identifier); suffix += 1) {
      identifier = `${base}-${suffix}`;
    }
  }
  return {
    coordinate: `${PROJECT_FORGE_KINDS.repository}:${project.pubkey}:${identifier}`,
    template: {
      kind: PROJECT_FORGE_KINDS.repository,
      created_at: createdAt,
      content: firstTagValue(project, "description"),
      tags: [
        ["d", identifier],
        [
          "name",
          `${firstTagValue(project, "name") || projectAddress.identifier} Tasks`,
        ],
        ["description", "Project-level task container"],
        ["project-task-anchor", "true"],
        ...(firstTagValue(project, "buzz-channel")
          ? [["buzz-channel", firstTagValue(project, "buzz-channel")]]
          : []),
      ],
    },
  };
}

export function addRepositoryToProjectTemplate(
  project: NostrEvent,
  repositoryCoordinate: string,
  relayHint?: string,
  createdAt = unixNow(),
): NostrEventTemplate {
  if (
    project.kind !== PROJECT_FORGE_KINDS.project ||
    !parseNostrAddress(repositoryCoordinate, PROJECT_FORGE_KINDS.repository)
  ) {
    throw new Error(
      "Project membership requires a kind 30617 repository coordinate",
    );
  }
  const existing = project.tags
    .filter((tag) => tag[0] === "a")
    .map((tag) => tag[1]);
  if (existing.includes(repositoryCoordinate)) {
    throw new Error("The repository already belongs to this project");
  }
  return {
    kind: project.kind,
    created_at: createdAt,
    content: project.content,
    tags: [
      ...project.tags.map((tag) => [...tag]),
      ["a", repositoryCoordinate, ...(relayHint ? [relayHint] : [])],
    ],
  };
}

export function createTaskTemplate(
  input: CreateTaskInput,
  createdAt = unixNow(),
): NostrEventTemplate {
  requiredRepository(input.repository);
  requiredPubkey(input.repositoryOwner, "Repository owner");
  requiredText(input.title, "Task title", 256);
  return {
    kind: PROJECT_FORGE_KINDS.task,
    created_at: createdAt,
    content: input.content,
    tags: [
      ["a", input.repository],
      ["p", input.repositoryOwner],
      ["subject", input.title],
      ...distinctNonempty(input.labels ?? []).map((label) => ["t", label]),
      ...distinctNonempty(input.assignees ?? []).map((pubkey) => ["p", pubkey]),
      ...(input.parentEventId
        ? [
            ["parent", requiredEventId(input.parentEventId, "Parent event")],
            ["e", input.parentEventId],
          ]
        : []),
    ],
  };
}

export function createPullRequestTemplate(
  input: CreatePullRequestInput,
  createdAt = unixNow(),
): NostrEventTemplate {
  requiredRepository(input.repository);
  requiredPubkey(input.repositoryOwner, "Repository owner");
  requiredText(input.title, "Pull request title", 256);
  requiredCommit(input.commit, "Pull request commit");
  const cloneUrls = distinctNonempty(input.cloneUrls);
  if (cloneUrls.length === 0)
    throw new Error("A pull request requires a clone locator");
  return {
    kind: PROJECT_FORGE_KINDS.pullRequest,
    created_at: createdAt,
    content: input.content,
    tags: [
      ["a", input.repository],
      ["p", input.repositoryOwner],
      ...distinctNonempty(input.reviewers ?? [])
        .filter((pubkey) => pubkey !== input.repositoryOwner)
        .map((pubkey) => ["p", requiredPubkey(pubkey, "Reviewer")]),
      ["subject", input.title],
      ["c", input.commit],
      ["clone", ...cloneUrls],
      ...(input.branchName ? [["branch-name", input.branchName]] : []),
      ...(input.targetBranch ? [["target-branch", input.targetBranch]] : []),
      ...(input.mergeBase
        ? [["merge-base", requiredCommit(input.mergeBase, "Merge base")]]
        : []),
      ...(input.originChannelId ? [["h", input.originChannelId]] : []),
      ...distinctNonempty(input.labels ?? []).map((label) => ["t", label]),
    ],
  };
}

export function createPullRequestUpdateTemplate(
  root: NostrEvent,
  repository: string,
  repositoryOwner: string,
  commit: string,
  cloneUrls: readonly string[],
  options: { mergeBase?: string; content?: string; createdAt?: number } = {},
): NostrEventTemplate {
  if (root.kind !== PROJECT_FORGE_KINDS.pullRequest) {
    throw new Error("A pull request update requires a kind 1618 root");
  }
  const locators = distinctNonempty(cloneUrls);
  if (locators.length === 0)
    throw new Error("A pull request update requires a clone locator");
  return {
    kind: PROJECT_FORGE_KINDS.pullRequestUpdate,
    created_at: options.createdAt ?? unixNow(),
    content: options.content ?? "",
    tags: [
      ["a", requiredRepository(repository)],
      ["p", requiredPubkey(repositoryOwner, "Repository owner")],
      ["E", requiredEventId(root.id, "Pull request root")],
      ["P", requiredPubkey(root.pubkey, "Pull request author")],
      ["c", requiredCommit(commit, "Pull request commit")],
      ["clone", ...locators],
      ...(options.mergeBase
        ? [["merge-base", requiredCommit(options.mergeBase, "Merge base")]]
        : []),
    ],
  };
}

export function createWorkItemStatusTemplate(
  root: NostrEvent,
  repository: string,
  lifecycle: ProjectTaskLifecycleInput | PullRequestLifecycleInput,
  options: {
    mergeCommit?: string;
    references?: readonly string[];
    createdAt?: number;
  } = {},
): NostrEventTemplate {
  const kind = statusKind(lifecycle);
  const mergeCommit = options.mergeCommit;
  if (mergeCommit && kind !== PROJECT_FORGE_KINDS.statusMerged) {
    throw new Error("A merge commit is only valid for merged status");
  }
  const references = distinctNonempty(options.references ?? []);
  if (mergeCommit) {
    requiredCommit(mergeCommit, "Merge commit");
    if (!references.includes(mergeCommit)) references.push(mergeCommit);
  }
  return {
    kind,
    created_at: options.createdAt ?? unixNow(),
    content: "",
    tags: [
      ["e", requiredEventId(root.id, "Work item"), "", "root"],
      ["a", requiredRepository(repository)],
      ...references.map((commit) => [
        "r",
        requiredCommit(commit, "Commit reference"),
      ]),
      ...(mergeCommit ? [["merge-commit", mergeCommit]] : []),
    ],
  };
}

type ProjectTaskLifecycleInput = "open" | "closed" | "draft" | "applied";
type PullRequestLifecycleInput = "open" | "merged" | "closed" | "draft";

export function createBuzzCommentTemplate(
  root: NostrEvent,
  repository: string,
  content: string,
  options: {
    commit?: string;
    anchor?: PullRequestInlineAnchor;
    labels?: readonly string[];
    recipients?: readonly string[];
    createdAt?: number;
  } = {},
): NostrEventTemplate {
  return {
    kind: PROJECT_FORGE_KINDS.note,
    created_at: options.createdAt ?? unixNow(),
    content,
    tags: [
      ["e", requiredEventId(root.id, "Work item"), "", "root"],
      ["a", requiredRepository(repository)],
      ...(options.commit
        ? [["c", requiredCommit(options.commit, "Comment commit")]]
        : []),
      ...(options.anchor
        ? [
            ["t", "inline-comment"],
            ["file", options.anchor.path],
            ["side", options.anchor.side],
            ["line", String(options.anchor.line)],
          ]
        : []),
      ...distinctNonempty(options.labels ?? []).map((label) => ["t", label]),
      ...distinctNonempty(options.recipients ?? []).map((pubkey) => [
        "p",
        requiredPubkey(pubkey, "Recipient"),
      ]),
    ],
  };
}

export function createReviewDecisionTemplate(
  root: NostrEvent,
  repository: string,
  decision: PullRequestDecisionKind,
  commit: string | undefined,
  content = "",
  createdAt = unixNow(),
): NostrEventTemplate {
  return createBuzzCommentTemplate(root, repository, content, {
    ...(commit ? { commit } : {}),
    labels: [decision === "approved" ? "approval" : "changes-requested"],
    createdAt,
  });
}

export function createReviewRequestTemplate(
  root: NostrEvent,
  repository: string,
  reviewers: readonly string[],
  createdAt = unixNow(),
): NostrEventTemplate {
  return createBuzzCommentTemplate(root, repository, "", {
    labels: ["review-request"],
    recipients: reviewers,
    createdAt,
  });
}

export function createAssignmentTemplate(
  root: NostrEvent,
  repository: string,
  assignees: readonly string[],
  assigned: boolean,
  createdAt = unixNow(),
): NostrEventTemplate {
  return createBuzzCommentTemplate(root, repository, "", {
    labels: [assigned ? "assignment" : "unassignment"],
    recipients: assignees,
    createdAt,
  });
}

export function createDeletionTemplate(
  target: NostrEvent,
  createdAt = unixNow(),
): NostrEventTemplate {
  const address = eventAddress(target);
  return {
    kind: PROJECT_FORGE_KINDS.deletion,
    created_at: createdAt,
    content: "",
    tags: address ? [["a", address.coordinate]] : [["e", target.id]],
  };
}

export function createProjectReactionTemplate(
  target: NostrEvent,
  repository: string,
  emoji: string,
  createdAt = unixNow(),
): NostrEventTemplate {
  requiredRepository(repository);
  requiredText(emoji, "Reaction", 64);
  return {
    kind: PROJECT_FORGE_KINDS.reaction,
    created_at: createdAt,
    content: emoji,
    tags: [
      ["e", target.id],
      ["p", target.pubkey],
      ["k", String(target.kind)],
      ["a", repository],
    ],
  };
}

function statusKind(
  lifecycle: ProjectTaskLifecycleInput | PullRequestLifecycleInput,
): number {
  if (lifecycle === "merged" || lifecycle === "applied")
    return PROJECT_FORGE_KINDS.statusMerged;
  if (lifecycle === "closed") return PROJECT_FORGE_KINDS.statusClosed;
  if (lifecycle === "draft") return PROJECT_FORGE_KINDS.statusDraft;
  return PROJECT_FORGE_KINDS.statusOpen;
}

function requiredRepository(value: string): string {
  if (!parseNostrAddress(value, PROJECT_FORGE_KINDS.repository)) {
    throw new Error("Repository must be a kind 30617 coordinate");
  }
  return value;
}

function requiredPubkey(value: string, label: string): string {
  if (!/^[0-9a-f]{64}$/u.test(value))
    throw new Error(`${label} must be a lowercase hex pubkey`);
  return value;
}

function requiredEventId(value: string, label: string): string {
  if (!/^[0-9a-f]{64}$/u.test(value))
    throw new Error(`${label} must be a lowercase hex event ID`);
  return value;
}

function requiredCommit(value: string, label: string): string {
  if (!isFullCommitId(value))
    throw new Error(`${label} must be a full SHA-1 or SHA-256 ID`);
  return value;
}

function requiredText(value: string, label: string, maxBytes: number): string {
  if (value.length === 0 || new TextEncoder().encode(value).length > maxBytes) {
    throw new Error(
      `${label} must be non-empty and no more than ${maxBytes} UTF-8 bytes`,
    );
  }
  return value;
}

function optionalText(
  value: string | undefined,
  label: string,
  maxBytes: number,
): void {
  if (
    value !== undefined &&
    new TextEncoder().encode(value).length > maxBytes
  ) {
    throw new Error(`${label} must be no more than ${maxBytes} UTF-8 bytes`);
  }
}

function distinctNonempty(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function unixNow(): number {
  return Math.floor(Date.now() / 1_000);
}
