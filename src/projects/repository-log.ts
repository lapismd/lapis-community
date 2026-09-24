import type { NostrEvent } from "../protocol/index.js";

import { repositoryLogAuthorFields } from "./repository-log-author.js";
import { projectRepositoryLog } from "./repository-log-collapse.js";
import {
  KIND_JJ_OPERATION_GRAPH,
  KIND_JJ_REVISION,
  KIND_JJ_VIEW,
} from "./work-item-filters.js";

export type RepositoryLogReason = "checkpoint" | "merge";

export type RepositoryLogRevision = {
  eventId: string;
  changeId: string;
  commitId?: string;
  parents: string[];
  message: string;
  reason: RepositoryLogReason;
  createdAt: number;
  committedAtMs?: number;
  root: string;
  author: string;
  authorEmail?: string;
  authorAvatarUrl?: string;
  empty: boolean;
};

export type RepositoryLogDevice = {
  publicKey: string;
  alias: string;
  revisionEventId: string;
  lastSeen: number;
};

export type RepositoryLogGraph = {
  revisions: RepositoryLogRevision[];
  devices: RepositoryLogDevice[];
};

type ViewBody = {
  schema?: unknown;
  view_id?: unknown;
  head_commit_ids?: unknown;
  local_bookmarks?: unknown;
  workspaces?: unknown;
};

const EMPTY_GRAPH: RepositoryLogGraph = { revisions: [], devices: [] };
export const REPOSITORY_LOG_EMPTY_DESCRIPTION = "(empty) (no description set)";

export function formatRepositoryLogMessage(
  description: string,
  isEmpty = false,
): string {
  const first = description.split("\n")[0]?.trim() ?? "";
  if (!first) return REPOSITORY_LOG_EMPTY_DESCRIPTION;
  return isEmpty ? `(empty) ${first}` : first;
}

export function buildRepositoryLog(
  events: readonly NostrEvent[],
  focusedCommitId?: string | null,
  selectedSeedId?: string | null,
): RepositoryLogGraph {
  const revisions = new Map<string, RepositoryLogRevision>();
  const views: { event: NostrEvent; body: ViewBody }[] = [];
  let contextViewId: string | undefined;
  let contextScore = -1;
  for (const event of events) {
    const body = parseJson(event.content);
    if (event.kind === KIND_JJ_REVISION) {
      const revision = parseRevision(event, body);
      if (revision) revisions.set(revision.eventId, revision);
      continue;
    }
    if (
      event.kind === KIND_JJ_VIEW &&
      isRecord(body) &&
      body.schema === "jj-sync/view"
    ) {
      views.push({ event, body });
      continue;
    }
    const recency = operationViewRecency(event.kind, body);
    if (recency && recency.score > contextScore) {
      contextViewId = recency.viewId;
      contextScore = recency.score;
    }
  }
  if (views.length === 0) return EMPTY_GRAPH;
  return projectRepositoryLog(
    [...revisions.values()],
    views,
    contextViewId,
    (ids) => devicesFromViews(views, contextViewId, ids),
    orderNewestFirst,
    focusedCommitId,
    selectedSeedId,
  );
}

function pinView(
  views: { event: NostrEvent; body: ViewBody }[],
  contextViewId: string | undefined,
): { event: NostrEvent; body: ViewBody } | undefined {
  if (contextViewId) {
    const matched = views.find((view) => view.body.view_id === contextViewId);
    if (matched) return matched;
  }
  return views.reduce<{ event: NostrEvent; body: ViewBody } | undefined>(
    (newest, view) => {
      if (!newest || view.event.created_at >= newest.event.created_at)
        return view;
      return newest;
    },
    undefined,
  );
}

function parseRevision(
  event: NostrEvent,
  body: unknown,
): RepositoryLogRevision | undefined {
  if (!isRecord(body) || body.schema !== "jj-sync/revision") return undefined;
  const commitId = asString(body.commit_id);
  if (!commitId) return undefined;
  const parents = stringList(body.parent_commit_ids);
  const description =
    typeof body.description === "string" ? body.description : "";
  const empty =
    body.is_empty === true ||
    (isRecord(body.facts) && body.facts.is_empty === true) ||
    description.trim() === "";
  return {
    eventId: commitId,
    commitId,
    changeId: changeIdHex(event, body),
    parents,
    message: formatRepositoryLogMessage(description, empty),
    reason: parents.length > 1 ? "merge" : "checkpoint",
    root: commitId,
    empty,
    ...(isRecord(body.committer) &&
    typeof body.committer.timestamp_ms === "number"
      ? { committedAtMs: body.committer.timestamp_ms }
      : {}),
    ...repositoryLogAuthorFields(body, event.created_at),
  };
}

function changeIdHex(event: NostrEvent, body: Record<string, unknown>): string {
  const raw =
    asString(body.change_id_hex) ??
    asString(event.tags.find((tag) => tag[0] === "i")?.[1]);
  return raw && /^[0-9a-fA-F]{32}$/u.test(raw) ? raw.toLowerCase() : "";
}

function operationViewRecency(
  kind: number,
  body: unknown,
): { viewId: string; score: number } | undefined {
  if (
    kind !== KIND_JJ_OPERATION_GRAPH ||
    !isRecord(body) ||
    body.schema !== "jj-sync/operation-graph"
  ) {
    return undefined;
  }
  const viewId = asString(body.view_id);
  const score = isRecord(body.metadata) ? body.metadata.ended_at_ms : undefined;
  return viewId && typeof score === "number" ? { viewId, score } : undefined;
}

function devicesFromViews(
  views: { event: NostrEvent; body: ViewBody }[],
  contextViewId: string | undefined,
  visible: Set<string>,
): RepositoryLogDevice[] {
  const pinned = pinView(views, contextViewId);
  return pinned ? devicesFromView(pinned.event, pinned.body, visible) : [];
}

function devicesFromView(
  event: NostrEvent,
  body: ViewBody,
  visible: Set<string>,
): RepositoryLogDevice[] {
  const devices: RepositoryLogDevice[] = [];
  for (const bookmark of arrayOf(body.local_bookmarks)) {
    const name = asString(bookmark.name);
    const commitId = resolvedCommitId(bookmark.target);
    if (name && commitId && visible.has(commitId)) {
      devices.push(device(event, name, commitId));
    }
  }
  for (const workspace of arrayOf(body.workspaces)) {
    const name = asString(workspace.native_workspace_name);
    const commitId = asString(workspace.working_copy_commit_id);
    if (name && commitId && visible.has(commitId)) {
      devices.push(device(event, name === "default" ? "@" : name, commitId));
    }
  }
  return devices;
}

function device(
  event: NostrEvent,
  alias: string,
  revisionEventId: string,
): RepositoryLogDevice {
  return {
    publicKey: event.pubkey,
    alias,
    revisionEventId,
    lastSeen: event.created_at,
  };
}

export function orderNewestFirst(
  revisions: RepositoryLogRevision[],
): RepositoryLogRevision[] {
  const byId = new Map(
    revisions.map((revision) => [revision.eventId, revision]),
  );
  const remaining = new Set(byId.keys());
  const childCount = new Map<string, number>();
  for (const revision of revisions) {
    for (const parent of revision.parents) {
      if (byId.has(parent)) {
        childCount.set(parent, (childCount.get(parent) ?? 0) + 1);
      }
    }
  }
  const tips = revisions.filter((revision) =>
    revisions.every((other) => !other.parents.includes(revision.eventId)),
  );
  const queue = sortRevisions(tips);
  const ordered: RepositoryLogRevision[] = [];
  while (queue.length > 0) {
    const next = queue.shift()!;
    if (!remaining.delete(next.eventId)) continue;
    ordered.push(next);
    for (const parentId of next.parents) {
      const parent = byId.get(parentId);
      if (!parent || !remaining.has(parentId)) continue;
      const left = (childCount.get(parentId) ?? 1) - 1;
      childCount.set(parentId, left);
      if (left <= 0) queue.push(parent);
    }
    queue.sort(compareRevisions);
  }
  for (const revision of sortRevisions(revisions)) {
    if (remaining.delete(revision.eventId)) ordered.push(revision);
  }
  return ordered;
}

function sortRevisions(
  revisions: RepositoryLogRevision[],
): RepositoryLogRevision[] {
  return revisions.slice().sort(compareRevisions);
}

function compareRevisions(
  left: RepositoryLogRevision,
  right: RepositoryLogRevision,
): number {
  return (
    right.createdAt - left.createdAt ||
    left.eventId.localeCompare(right.eventId)
  );
}

function resolvedCommitId(target: unknown): string | undefined {
  if (!isRecord(target) || target.state !== "resolved") return undefined;
  return asString(target.commit_id);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function arrayOf(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function parseJson(content: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    return undefined;
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
