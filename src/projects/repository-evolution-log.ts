import type { NostrEvent } from "../protocol/index.js";

import { repositoryLogAuthorFields } from "./repository-log-author.js";
import {
  REPOSITORY_LOG_EMPTY_DESCRIPTION,
  formatRepositoryLogMessage,
  orderNewestFirst,
  type RepositoryLogGraph,
  type RepositoryLogRevision,
} from "./repository-log.js";
import {
  KIND_JJ_OPERATION_GRAPH,
  KIND_JJ_REVISION,
} from "./work-item-filters.js";

const EMPTY: RepositoryLogGraph = { revisions: [], devices: [] };

export function buildRepositoryEvolutionLog(
  events: readonly NostrEvent[],
  startCommitId: string,
  changeId = "",
): RepositoryLogGraph {
  if (!startCommitId) return EMPTY;
  const revisions = new Map<string, RepositoryLogRevision>();
  const predecessors = new Map<string, string[]>();
  let recorded = false;
  for (const event of events) {
    const body = parseJson(event.content);
    if (event.kind === KIND_JJ_REVISION) {
      const revision = parseRevision(event, body);
      if (revision) revisions.set(revision.eventId, revision);
      continue;
    }
    if (
      event.kind !== KIND_JJ_OPERATION_GRAPH ||
      !isRecord(body) ||
      body.schema !== "jj-sync/operation-graph" ||
      !isRecord(body.evolution) ||
      body.evolution.recording !== "recorded"
    ) {
      continue;
    }
    recorded = true;
    for (const entry of arrayOf(body.evolution.entries)) {
      const commitId = asString(entry.commit_id);
      if (!commitId) continue;
      predecessors.set(commitId, stringList(entry.predecessor_commit_ids));
    }
  }
  const visited = new Set<string>();
  const queue = [startCommitId];
  while (queue.length > 0) {
    const commitId = queue.shift()!;
    if (!visited.add(commitId)) continue;
    queue.push(...(predecessors.get(commitId) ?? []));
  }
  if (changeId) {
    for (const revision of revisions.values()) {
      if (revision.changeId === changeId) visited.add(revision.eventId);
    }
  }
  const extras = [...visited].filter((id) => id !== startCommitId);
  if (!recorded && extras.length === 0) return EMPTY;
  if (
    extras.length === 0 &&
    (predecessors.get(startCommitId)?.length ?? 0) === 0
  ) {
    return EMPTY;
  }
  const nodes = [...visited].map(
    (id) =>
      hydrate(revisions.get(id), id, predecessors.get(id) ?? []) ??
      stub(id, predecessors.get(id) ?? []),
  );
  return { revisions: orderNewestFirst(nodes), devices: [] };
}

function hydrate(
  revision: RepositoryLogRevision | undefined,
  commitId: string,
  parents: string[],
): RepositoryLogRevision | undefined {
  return revision ? { ...revision, eventId: commitId, parents } : undefined;
}

function stub(commitId: string, parents: string[]): RepositoryLogRevision {
  return {
    eventId: commitId,
    changeId: "",
    parents,
    message: REPOSITORY_LOG_EMPTY_DESCRIPTION,
    reason: parents.length > 1 ? "merge" : "checkpoint",
    createdAt: 0,
    root: commitId,
    author: "",
    empty: true,
  };
}

function parseRevision(
  event: NostrEvent,
  body: unknown,
): RepositoryLogRevision | undefined {
  if (!isRecord(body) || body.schema !== "jj-sync/revision") return undefined;
  const commitId = asString(body.commit_id);
  if (!commitId) return undefined;
  const description =
    typeof body.description === "string" ? body.description : "";
  const empty =
    body.is_empty === true ||
    (isRecord(body.facts) && body.facts.is_empty === true) ||
    description.trim() === "";
  return {
    eventId: commitId,
    changeId: changeIdHex(event, body),
    parents: stringList(body.parent_commit_ids),
    message: formatRepositoryLogMessage(description, empty),
    reason: "checkpoint",
    root: commitId,
    empty,
    ...repositoryLogAuthorFields(body, event.created_at),
  };
}

function changeIdHex(event: NostrEvent, body: Record<string, unknown>): string {
  const raw =
    asString(body.change_id_hex) ??
    asString(event.tags.find((tag) => tag[0] === "i")?.[1]);
  return raw && /^[0-9a-fA-F]{32}$/u.test(raw) ? raw.toLowerCase() : "";
}

function parseJson(content: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    return undefined;
  }
}

function arrayOf(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
