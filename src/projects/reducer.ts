import type { NostrEvent } from "../protocol/index.js";
import {
  PROJECT_FORGE_KINDS,
  allTagValues,
  compareChronological,
  compareNewestSmallestId,
  eventAddress,
  firstTagValue,
  isFullCommitId,
  parseNostrAddress,
  rootEventId,
  tagsNamed,
  type ProjectForgeCatalog,
  type ProjectForgeProject,
  type ProjectForgeRepository,
  type ProjectForgeWorkItems,
  type ProjectTaskActivity,
  type ProjectTaskLifecycle,
  type ProjectTaskState,
  type PullRequestComment,
  type PullRequestDecision,
  type PullRequestDecisionKind,
  type PullRequestInlineAnchor,
  type PullRequestLifecycle,
  type PullRequestState,
} from "./model.js";

const STATUS_KINDS = new Set<number>([
  PROJECT_FORGE_KINDS.statusOpen,
  PROJECT_FORGE_KINDS.statusMerged,
  PROJECT_FORGE_KINDS.statusClosed,
  PROJECT_FORGE_KINDS.statusDraft,
]);

export function materializeProjectForgeCatalog(
  events: readonly NostrEvent[],
): ProjectForgeCatalog {
  const visible = visibleEvents(events);
  const replaceable = newestReplaceableEvents(
    visible.filter(
      (event) =>
        event.kind === PROJECT_FORGE_KINDS.project ||
        event.kind === PROJECT_FORGE_KINDS.repository,
    ),
  );
  const repositories = replaceable
    .filter((event) => event.kind === PROJECT_FORGE_KINDS.repository)
    .map(projectRepositoryFromEvent)
    .filter((value): value is ProjectForgeRepository => value !== undefined)
    .toSorted((left, right) =>
      compareNewestSmallestId(left.event, right.event),
    );
  const projects = replaceable
    .filter((event) => event.kind === PROJECT_FORGE_KINDS.project)
    .map(projectFromEvent)
    .filter((value): value is ProjectForgeProject => value !== undefined)
    .toSorted((left, right) =>
      compareNewestSmallestId(left.event, right.event),
    );
  return { projects, repositories, events: visible };
}

export function materializeProjectForgeWorkItems(
  repositoryEvent: NostrEvent,
  events: readonly NostrEvent[],
): ProjectForgeWorkItems {
  const repository = eventAddress(repositoryEvent);
  if (
    repositoryEvent.kind !== PROJECT_FORGE_KINDS.repository ||
    repository === undefined
  ) {
    throw new Error("Work items require a kind 30617 repository announcement");
  }
  const visible = visibleEvents(events);
  const roots = visible.filter(
    (event) =>
      (event.kind === PROJECT_FORGE_KINDS.task ||
        event.kind === PROJECT_FORGE_KINDS.pullRequest) &&
      firstTagValue(event, "a") === repository.coordinate,
  );
  return {
    tasks: roots
      .filter((event) => event.kind === PROJECT_FORGE_KINDS.task)
      .map((event) => reduceProjectTask(event, repositoryEvent, visible))
      .toSorted((left, right) =>
        compareNewestSmallestId(left.root, right.root),
      ),
    pullRequests: roots
      .filter((event) => event.kind === PROJECT_FORGE_KINDS.pullRequest)
      .map((event) => reducePullRequest(event, repositoryEvent, visible))
      .toSorted((left, right) =>
        compareNewestSmallestId(left.root, right.root),
      ),
    events: visible,
  };
}

export function reduceProjectTask(
  root: NostrEvent,
  repositoryEvent: NostrEvent,
  related: readonly NostrEvent[],
): ProjectTaskState {
  const repository = eventAddress(repositoryEvent);
  if (
    root.kind !== PROJECT_FORGE_KINDS.task ||
    repository === undefined ||
    firstTagValue(root, "a") !== repository.coordinate
  ) {
    throw new Error("Task root and repository do not match");
  }
  const candidates = related
    .filter((event) => rootEventId(event) === root.id)
    .toSorted(compareChronological);
  const trustedActors = new Set([root.pubkey, repository.owner]);
  let statusEvent: NostrEvent | undefined;
  for (const event of candidates) {
    if (!STATUS_KINDS.has(event.kind) || !trustedActors.has(event.pubkey))
      continue;
    if (!repositoryMatchesIfPresent(event, repository.coordinate)) continue;
    if (!statusEvent || compareNewestSmallestId(event, statusEvent) < 0) {
      statusEvent = event;
    }
  }

  const assignmentEvents = candidates.filter(
    (event) =>
      event.kind === PROJECT_FORGE_KINDS.note &&
      repositoryMatchesIfPresent(event, repository.coordinate) &&
      assignmentKind(event) !== undefined,
  );
  const assignees = reduceAssignments(assignmentEvents, trustedActors);
  const activity = candidates
    .filter(
      (event) =>
        (event.kind === PROJECT_FORGE_KINDS.note &&
          repositoryMatchesIfPresent(event, repository.coordinate)) ||
        (event.kind === PROJECT_FORGE_KINDS.comment &&
          firstTagValue(event, "K") === String(PROJECT_FORGE_KINDS.task) &&
          firstTagValue(event, "E") === root.id),
    )
    .map<ProjectTaskActivity>((event) => {
      const assignment = assignmentKind(event);
      return {
        event,
        encoding:
          event.kind === PROJECT_FORGE_KINDS.note ? "buzz-kind-1" : "nip-22",
        ...(assignment === undefined ? {} : { assignment }),
        assignees: validPubkeys(event, "p"),
      };
    });
  const lifecycle = taskLifecycle(statusEvent?.kind);
  return {
    root,
    repository,
    title:
      firstTagValue(root, "subject") ||
      firstLine(root.content) ||
      "Untitled task",
    content: root.content,
    labels: allTagValues(root, "t"),
    lifecycle,
    ...(statusEvent === undefined ? {} : { statusEvent }),
    assignees,
    activity,
    createdAt: root.created_at,
    updatedAt: Math.max(
      root.created_at,
      ...candidates.map((event) => event.created_at),
    ),
  };
}

export function reducePullRequest(
  root: NostrEvent,
  repositoryEvent: NostrEvent,
  related: readonly NostrEvent[],
): PullRequestState {
  const repository = eventAddress(repositoryEvent);
  if (
    root.kind !== PROJECT_FORGE_KINDS.pullRequest ||
    repository === undefined ||
    firstTagValue(root, "a") !== repository.coordinate
  ) {
    throw new Error("Pull request root and repository do not match");
  }
  const initialCommit = firstTagValue(root, "c");
  const trustedRootActors = new Set([root.pubkey, repository.owner]);
  const relatedOrdered = related.toSorted(compareChronological);
  const updates = relatedOrdered
    .filter(
      (event) =>
        event.kind === PROJECT_FORGE_KINDS.pullRequestUpdate &&
        firstTagValue(event, "E") === root.id &&
        firstTagValue(event, "P") === root.pubkey &&
        firstTagValue(event, "a") === repository.coordinate &&
        trustedRootActors.has(event.pubkey) &&
        isFullCommitId(firstTagValue(event, "c")),
    )
    .map((event) => ({
      event,
      commit: firstTagValue(event, "c"),
      cloneUrls: allTagValues(event, "clone"),
      mergeBase: firstTagValue(event, "merge-base"),
    }));
  const latestUpdate = updates
    .map((update) => update.event)
    .toSorted(compareNewestSmallestId)[0];
  const currentCommit = latestUpdate
    ? firstTagValue(latestUpdate, "c")
    : initialCommit;
  const cloneUrls = latestUpdate
    ? allTagValues(latestUpdate, "clone")
    : allTagValues(root, "clone");
  const mergeBase =
    (latestUpdate && firstTagValue(latestUpdate, "merge-base")) ||
    firstTagValue(root, "merge-base");

  const statusEvent = relatedOrdered
    .filter(
      (event) =>
        STATUS_KINDS.has(event.kind) &&
        rootEventId(event) === root.id &&
        repositoryMatchesIfPresent(event, repository.coordinate) &&
        trustedRootActors.has(event.pubkey),
    )
    .toSorted(compareNewestSmallestId)[0];
  const comments = relatedOrdered
    .filter(
      (event) =>
        (event.kind === PROJECT_FORGE_KINDS.note &&
          rootEventId(event) === root.id &&
          repositoryMatchesIfPresent(event, repository.coordinate)) ||
        (event.kind === PROJECT_FORGE_KINDS.comment &&
          firstTagValue(event, "K") ===
            String(PROJECT_FORGE_KINDS.pullRequest) &&
          firstTagValue(event, "E") === root.id),
    )
    .map((event) => parsePullRequestComment(event));

  const reviewers = new Set(validPubkeys(root, "p"));
  for (const comment of comments) {
    if (
      comment.isReviewRequest &&
      trustedRootActors.has(comment.event.pubkey)
    ) {
      for (const reviewer of comment.reviewerPubkeys) reviewers.add(reviewer);
    }
  }
  reviewers.delete(root.pubkey);
  const reviewerList = [...reviewers].toSorted();
  const trustedReviewers = new Set(reviewerList);
  if (repository.owner !== root.pubkey) trustedReviewers.add(repository.owner);
  const latestDecision = new Map<string, PullRequestDecision>();

  for (const comment of comments) {
    comment.isTrustedReviewRequest =
      comment.isReviewRequest && trustedRootActors.has(comment.event.pubkey);
    if (comment.decision) {
      comment.isTrustedDecision =
        comment.event.pubkey !== root.pubkey &&
        trustedReviewers.has(comment.event.pubkey);
      const commit = comment.commit || initialCommit;
      comment.decisionStatus =
        commit === currentCommit ? "current" : "historical";
      if (
        comment.isTrustedDecision &&
        comment.decisionStatus === "current" &&
        currentCommit
      ) {
        const candidate: PullRequestDecision = {
          event: comment.event,
          reviewer: comment.event.pubkey,
          commit,
          decision: comment.decision,
        };
        const current = latestDecision.get(candidate.reviewer);
        if (
          !current ||
          candidate.event.created_at > current.event.created_at ||
          (candidate.event.created_at === current.event.created_at &&
            candidate.event.id > current.event.id)
        ) {
          latestDecision.set(candidate.reviewer, candidate);
        }
      }
    }
    if (comment.anchor) {
      comment.inlineStatus =
        (comment.commit || initialCommit) === currentCommit
          ? "current"
          : "outdated";
    }
  }
  const decisions = [...latestDecision.values()].toSorted((left, right) =>
    compareChronological(left.event, right.event),
  );
  const defaultLifecycle: PullRequestLifecycle = allTagValues(root, "t").some(
    (value) => value.toLocaleLowerCase() === "draft",
  )
    ? "draft"
    : "open";
  return {
    root,
    repository,
    title: firstTagValue(root, "subject"),
    content: root.content,
    labels: allTagValues(root, "t"),
    recipients: validPubkeys(root, "p"),
    initialCommit,
    currentCommit,
    cloneUrls,
    branchName: firstTagValue(root, "branch-name"),
    targetBranch: firstTagValue(root, "target-branch"),
    mergeBase,
    lifecycle: statusEvent
      ? pullRequestLifecycle(statusEvent.kind)
      : defaultLifecycle,
    ...(statusEvent === undefined ? {} : { statusEvent }),
    mergeCommit: statusEvent ? firstTagValue(statusEvent, "merge-commit") : "",
    mergeReferences: statusEvent ? allTagValues(statusEvent, "r") : [],
    reviewers: reviewerList,
    approvals: decisions.filter((decision) => decision.decision === "approved"),
    changeRequests: decisions.filter(
      (decision) => decision.decision === "changes-requested",
    ),
    updates,
    comments,
    createdAt: root.created_at,
    updatedAt: Math.max(
      root.created_at,
      ...relatedOrdered.map((event) => event.created_at),
    ),
  };
}

export function projectFromEvent(
  event: NostrEvent,
): ProjectForgeProject | undefined {
  const address = eventAddress(event);
  if (event.kind !== PROJECT_FORGE_KINDS.project || !address) return undefined;
  const repositories = tagsNamed(event, "a")
    .map((tag) => ({
      coordinate: tag[1] ?? "",
      ...(tag[2] === undefined ? {} : { relayHint: tag[2] }),
    }))
    .filter(
      (reference) =>
        parseNostrAddress(
          reference.coordinate,
          PROJECT_FORGE_KINDS.repository,
        ) !== undefined,
    );
  return {
    event,
    address,
    name: firstTagValue(event, "name") || address.identifier,
    description: firstTagValue(event, "description") || event.content,
    channelId: firstTagValue(event, "buzz-channel"),
    ...(firstTagValue(event, "buzz-visibility")
      ? { visibility: firstTagValue(event, "buzz-visibility") }
      : {}),
    repositories,
  };
}

export function projectRepositoryFromEvent(
  event: NostrEvent,
): ProjectForgeRepository | undefined {
  const address = eventAddress(event);
  if (event.kind !== PROJECT_FORGE_KINDS.repository || !address)
    return undefined;
  const cloneUrls = allTagValues(event, "clone");
  return {
    event,
    address,
    name: firstTagValue(event, "name") || address.identifier,
    description: firstTagValue(event, "description") || event.content,
    channelId: firstTagValue(event, "buzz-channel"),
    cloneUrls,
    webUrls: allTagValues(event, "web"),
    repositoryClass:
      firstTagValue(event, "project-task-anchor") === "true"
        ? "task-anchor"
        : cloneUrls.length === 0
          ? "hosted"
          : "external",
  };
}

export function visibleEvents(events: readonly NostrEvent[]): NostrEvent[] {
  const deletions = events.filter(
    (event) => event.kind === PROJECT_FORGE_KINDS.deletion,
  );
  return events.filter((event) => {
    if (event.kind === PROJECT_FORGE_KINDS.deletion) return true;
    const address = eventAddress(event)?.coordinate;
    return !deletions.some(
      (deletion) =>
        deletion.pubkey === event.pubkey &&
        deletion.created_at >= event.created_at &&
        (allTagValues(deletion, "e").includes(event.id) ||
          (address !== undefined &&
            allTagValues(deletion, "a").includes(address))),
    );
  });
}

function newestReplaceableEvents(events: readonly NostrEvent[]): NostrEvent[] {
  const byAddress = new Map<string, NostrEvent>();
  for (const event of events) {
    const address = eventAddress(event)?.coordinate;
    if (!address) continue;
    const current = byAddress.get(address);
    if (!current || compareNewestSmallestId(event, current) < 0)
      byAddress.set(address, event);
  }
  return [...byAddress.values()];
}

function parsePullRequestComment(event: NostrEvent): PullRequestComment {
  const labels = allTagValues(event, "t").map((value) =>
    value.toLocaleLowerCase(),
  );
  const approval = labels.includes("approval");
  const changesRequested = labels.includes("changes-requested");
  const decision: PullRequestDecisionKind | undefined =
    approval === changesRequested
      ? undefined
      : approval
        ? "approved"
        : "changes-requested";
  const isReviewRequest = labels.includes("review-request");
  const anchor =
    !isReviewRequest && !approval ? inlineAnchor(event) : undefined;
  return {
    event,
    encoding:
      event.kind === PROJECT_FORGE_KINDS.note ? "buzz-kind-1" : "nip-22",
    commit: firstTagValue(event, "c"),
    ...(anchor === undefined ? {} : { anchor }),
    isInlineComment: anchor !== undefined || labels.includes("inline-comment"),
    isReviewRequest,
    isTrustedReviewRequest: false,
    reviewerPubkeys: isReviewRequest ? validPubkeys(event, "p") : [],
    ...(decision === undefined ? {} : { decision }),
    isTrustedDecision: false,
  };
}

function inlineAnchor(event: NostrEvent): PullRequestInlineAnchor | undefined {
  const path = firstTagValue(event, "file");
  const side = firstTagValue(event, "side");
  const lineValue = firstTagValue(event, "line");
  const line = Number(lineValue);
  if (
    path.length === 0 ||
    path.length > 4_096 ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path.includes("\0") ||
    path
      .split("/")
      .some((part) => part === "" || part === "." || part === "..") ||
    (side !== "old" && side !== "new") ||
    !/^[1-9][0-9]*$/u.test(lineValue) ||
    !Number.isSafeInteger(line)
  ) {
    return undefined;
  }
  return { path, side, line };
}

function reduceAssignments(
  events: readonly NostrEvent[],
  trustedActors: ReadonlySet<string>,
): string[] {
  const assigned = new Set<string>();
  for (const event of events) {
    const operation = assignmentKind(event);
    if (!operation) continue;
    const pubkeys = validPubkeys(event, "p");
    const allowed = trustedActors.has(event.pubkey)
      ? pubkeys
      : pubkeys.length === 1 && pubkeys[0] === event.pubkey
        ? pubkeys
        : [];
    for (const pubkey of allowed) {
      if (operation === "assign") assigned.add(pubkey);
      else assigned.delete(pubkey);
    }
  }
  return [...assigned].toSorted();
}

function assignmentKind(event: NostrEvent): "assign" | "unassign" | undefined {
  const labels = allTagValues(event, "t").map((value) =>
    value.toLocaleLowerCase(),
  );
  if (labels.includes("assignment") === labels.includes("unassignment"))
    return undefined;
  return labels.includes("assignment") ? "assign" : "unassign";
}

function validPubkeys(event: NostrEvent, name: string): string[] {
  return [
    ...new Set(
      allTagValues(event, name).filter((value) =>
        /^[0-9a-f]{64}$/u.test(value),
      ),
    ),
  ];
}

function repositoryMatchesIfPresent(
  event: NostrEvent,
  coordinate: string,
): boolean {
  const tags = tagsNamed(event, "a");
  return (
    tags.length === 0 || (tags.length === 1 && tags[0]?.[1] === coordinate)
  );
}

function taskLifecycle(kind: number | undefined): ProjectTaskLifecycle {
  if (kind === PROJECT_FORGE_KINDS.statusClosed) return "closed";
  if (kind === PROJECT_FORGE_KINDS.statusDraft) return "draft";
  if (kind === PROJECT_FORGE_KINDS.statusMerged) return "applied";
  return "open";
}

function pullRequestLifecycle(kind: number): PullRequestLifecycle {
  if (kind === PROJECT_FORGE_KINDS.statusMerged) return "merged";
  if (kind === PROJECT_FORGE_KINDS.statusClosed) return "closed";
  if (kind === PROJECT_FORGE_KINDS.statusDraft) return "draft";
  return "open";
}

function firstLine(content: string): string {
  return content.split(/\r?\n/u)[0]?.trim() ?? "";
}
