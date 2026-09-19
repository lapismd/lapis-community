import type { NostrEvent } from "../protocol/index.js";

import {
  KIND_JJ_AGENT_CONTEXT_PAGE,
  KIND_JJ_CHECKPOINT_MANIFEST,
  KIND_JJ_GRAPH_MANIFEST,
} from "./work-item-filters.js";
import {
  arrayLength,
  exactEventTag,
  isCheckpointOutcome,
  isRecord,
  nonEmptyString,
  nonEmptyStringList,
  nonNegativeInteger,
  parseAgentContextRecord,
  parseJsonRecord,
} from "./repository-agent-context-parsing.js";
import type { RepositoryAgentContextRecord } from "./repository-agent-context-parsing.js";

export type { RepositoryAgentContextRecord } from "./repository-agent-context-parsing.js";

export type RepositoryAgentCheckpoint = {
  eventId: string;
  checkpointId: string;
  spanId: string;
  scopeId: string;
  operationId: string;
  commitIds: string[];
  authorPubkey: string;
  createdAt: number;
  complete: boolean;
  outcome: "completed" | "failed" | "cancelled";
  records: RepositoryAgentContextRecord[];
};

type Page = {
  event: NostrEvent;
  checkpointId: string;
  spanId: string;
  scopeId: string;
  operationId: string;
  index: number;
  count: number;
  records: RepositoryAgentContextRecord[];
};

export function buildRepositoryAgentContexts(
  events: readonly NostrEvent[],
): RepositoryAgentCheckpoint[] {
  const byId = new Map(events.map((event) => [event.id, event]));
  return events
    .filter((event) => event.kind === KIND_JJ_CHECKPOINT_MANIFEST)
    .flatMap((manifest) => {
      const checkpoint = assembleCheckpoint(manifest, byId, events);
      return checkpoint ? [checkpoint] : [];
    })
    .toSorted(
      (left, right) =>
        right.createdAt - left.createdAt ||
        left.eventId.localeCompare(right.eventId),
    );
}

export function repositoryAgentContextsForSelection(
  checkpoints: readonly RepositoryAgentCheckpoint[],
  pane: "log" | "oplog",
  selectedId: string | null,
): RepositoryAgentCheckpoint[] {
  if (!selectedId) return [];
  return checkpoints.filter((checkpoint) =>
    pane === "oplog"
      ? checkpoint.operationId === selectedId
      : checkpoint.commitIds.includes(selectedId),
  );
}

function assembleCheckpoint(
  event: NostrEvent,
  byId: ReadonlyMap<string, NostrEvent>,
  events: readonly NostrEvent[],
): RepositoryAgentCheckpoint | undefined {
  const body = parseJsonRecord(event.content);
  if (
    body.schema !== "jj-sync/checkpoint-manifest" ||
    body.version !== 1 ||
    typeof body.complete !== "boolean" ||
    !isCheckpointOutcome(body.outcome)
  )
    return;
  const checkpointId = nonEmptyString(body.checkpoint_id);
  const spanId = nonEmptyString(body.span_id);
  const scopeId = nonEmptyString(body.scope_id);
  const operationId = nonEmptyString(body.operation_id);
  const pageIds = nonEmptyStringList(body.page_event_ids);
  const recordCount = nonNegativeInteger(body.record_count);
  const address = exactEventTag(event, "a");
  const group = exactEventTag(event, "h");
  if (
    !checkpointId ||
    !spanId ||
    !scopeId ||
    !operationId ||
    recordCount === undefined ||
    pageIds.length !== arrayLength(body.page_event_ids) ||
    new Set(pageIds).size !== pageIds.length ||
    !address ||
    !group ||
    exactEventTag(event, "r") !== scopeId ||
    exactEventTag(event, "o") !== operationId ||
    exactEventTag(event, "d") !== checkpointId
  )
    return;
  const pages = pageIds.map((id) =>
    parsePage(byId.get(id), event, {
      checkpointId,
      spanId,
      scopeId,
      operationId,
      address,
      group,
      count: pageIds.length,
    }),
  );
  if (pages.some((page) => page === undefined)) return;
  const ordered = (pages as Page[]).toSorted(
    (left, right) => left.index - right.index,
  );
  if (ordered.some((page, index) => page.index !== index)) return;
  const records = ordered.flatMap((page) => page.records);
  if (
    records.length !== recordCount ||
    records.some(
      (record, index) =>
        index > 0 && record.sequence <= records[index - 1]!.sequence,
    )
  )
    return;
  return {
    eventId: event.id,
    checkpointId,
    spanId,
    scopeId,
    operationId,
    commitIds: graphCommitIds(
      events,
      event,
      scopeId,
      operationId,
      address,
      group,
    ),
    authorPubkey: event.pubkey,
    createdAt: event.created_at,
    complete: body.complete,
    outcome: body.outcome,
    records,
  };
}

function parsePage(
  event: NostrEvent | undefined,
  manifest: NostrEvent,
  expected: {
    checkpointId: string;
    spanId: string;
    scopeId: string;
    operationId: string;
    address: string;
    group: string;
    count: number;
  },
): Page | undefined {
  if (
    !event ||
    event.kind !== KIND_JJ_AGENT_CONTEXT_PAGE ||
    event.pubkey !== manifest.pubkey
  )
    return;
  const body = parseJsonRecord(event.content);
  const index = nonNegativeInteger(body.page_index);
  const count = nonNegativeInteger(body.page_count);
  if (
    body.schema !== "jj-sync/agent-context-page" ||
    body.version !== 1 ||
    body.checkpoint_id !== expected.checkpointId ||
    body.span_id !== expected.spanId ||
    body.scope_id !== expected.scopeId ||
    body.operation_id !== expected.operationId ||
    index === undefined ||
    count !== expected.count ||
    exactEventTag(event, "r") !== expected.scopeId ||
    exactEventTag(event, "o") !== expected.operationId ||
    exactEventTag(event, "d") !== expected.checkpointId ||
    exactEventTag(event, "a") !== expected.address ||
    exactEventTag(event, "h") !== expected.group ||
    !Array.isArray(body.records)
  )
    return;
  const records = body.records.map(parseAgentContextRecord);
  if (records.some((record) => record === undefined)) return;
  return {
    event,
    checkpointId: expected.checkpointId,
    spanId: expected.spanId,
    scopeId: expected.scopeId,
    operationId: expected.operationId,
    index,
    count,
    records: records as RepositoryAgentContextRecord[],
  };
}

function graphCommitIds(
  events: readonly NostrEvent[],
  manifest: NostrEvent,
  scopeId: string,
  operationId: string,
  address: string,
  group: string,
): string[] {
  return events.flatMap((event) => {
    if (
      event.kind !== KIND_JJ_GRAPH_MANIFEST ||
      event.pubkey !== manifest.pubkey ||
      exactEventTag(event, "r") !== scopeId ||
      exactEventTag(event, "a") !== address ||
      exactEventTag(event, "h") !== group
    )
      return [];
    const body = parseJsonRecord(event.content);
    return body.schema === "jj-sync/graph-publication" &&
      body.version === 1 &&
      body.scope_id === scopeId &&
      isRecord(body.context) &&
      body.context.operation_id === operationId &&
      exactEventTag(event, "o") === operationId &&
      isRecord(body.selection)
      ? nonEmptyStringList(body.selection.seed_commit_ids)
      : [];
  });
}
