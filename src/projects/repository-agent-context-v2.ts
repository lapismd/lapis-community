import type { NostrEvent } from "../protocol/index.js";
import type { RepositoryAgentCheckpoint } from "./repository-agent-context.js";
import {
  exactEventTag,
  isCheckpointOutcome,
  isRecord,
  nonEmptyString,
  nonNegativeInteger,
  parseAgentContextRecord,
  parseJsonRecord,
  type RepositoryAgentContextRecord,
} from "./repository-agent-context-parsing.js";

/** Validate the signed association independently from availability of its pages. */
export function assembleRepositoryContextV2(
  event: NostrEvent,
  body: Record<string, unknown>,
  byId: ReadonlyMap<string, NostrEvent>,
): RepositoryAgentCheckpoint | undefined {
  const checkpointId = nonEmptyString(body.checkpoint_id);
  const spanId = nonEmptyString(body.span_id);
  const scopeId = nonEmptyString(body.scope_id);
  const operationId = nonEmptyString(body.operation_id);
  const baseline = nonEmptyString(body.begin_operation_id);
  const address = exactEventTag(event, "a"),
    group = exactEventTag(event, "h");
  if (
    body.schema !== "jj-sync/checkpoint-manifest" ||
    !checkpointId ||
    !spanId ||
    !scopeId ||
    !operationId ||
    !baseline ||
    !address ||
    !group ||
    !isCheckpointOutcome(body.outcome) ||
    typeof body.complete !== "boolean" ||
    exactEventTag(event, "r") !== scopeId ||
    exactEventTag(event, "o") !== operationId ||
    exactEventTag(event, "d") !== checkpointId ||
    !Array.isArray(body.page_event_ids) ||
    !body.page_event_ids.every(
      (id) => typeof id === "string" && /^[a-f0-9]{64}$/u.test(id),
    ) ||
    new Set(body.page_event_ids).size !== body.page_event_ids.length ||
    nonNegativeInteger(body.record_count) === undefined
  )
    return;
  const targets = body.targets ?? [];
  if (
    !Array.isArray(targets) ||
    !targets.every(
      (target) =>
        isRecord(target) &&
        typeof target.commit_id === "string" &&
        /^[a-f0-9]{40}$/u.test(target.commit_id) &&
        typeof target.change_id_hex === "string" &&
        /^[a-f0-9]{32}$/u.test(target.change_id_hex),
    )
  )
    return;
  if (
    body.actor !== undefined &&
    (!isRecord(body.actor) || body.actor.pubkey !== event.pubkey)
  )
    return;
  const checkpoint: RepositoryAgentCheckpoint = {
    eventId: event.id,
    checkpointId,
    spanId,
    scopeId,
    operationId,
    commitIds: [...new Set(targets.map((target) => String(target.commit_id)))],
    authorPubkey: event.pubkey,
    createdAt: event.created_at,
    complete: body.complete,
    ...(isRecord(body.actor) && typeof body.actor.name === "string"
      ? { actorName: body.actor.name }
      : {}),
    outcome: body.outcome,
    records: [],
    availability: "complete",
  };
  if (body.page_event_ids.some((id) => !byId.has(id)))
    return { ...checkpoint, availability: "missing" };
  const records: RepositoryAgentContextRecord[] = [];
  let fragments:
    | {
        record: RepositoryAgentContextRecord;
        count: number;
        next: number;
        metadata: string;
      }
    | undefined;
  for (const id of body.page_event_ids) {
    const page = byId.get(id)!;
    const value = parseJsonRecord(page.content);
    if (
      page.kind !== 3908 ||
      page.pubkey !== event.pubkey ||
      new TextEncoder().encode(page.content).byteLength > 48 * 1024 ||
      value.schema !== "jj-sync/agent-context-page" ||
      value.version !== 2 ||
      value.span_id !== spanId ||
      value.checkpoint_id !== spanId ||
      value.operation_id !== baseline ||
      value.scope_id !== scopeId ||
      exactEventTag(page, "r") !== scopeId ||
      exactEventTag(page, "o") !== baseline ||
      exactEventTag(page, "d") !== spanId ||
      exactEventTag(page, "a") !== address ||
      exactEventTag(page, "h") !== group ||
      !Array.isArray(value.records) ||
      value.records.length !== 1
    )
      return;
    const index = nonNegativeInteger(value.page_index),
      count = nonNegativeInteger(value.page_count);
    const record = parseAgentContextRecord(value.records[0]);
    if (
      !record ||
      index === undefined ||
      count === undefined ||
      count < 1 ||
      index >= count
    )
      return;
    const { text: _text, ...metadata } = record;
    const signature = JSON.stringify(metadata);
    if (index === 0) {
      if (fragments) return;
      fragments = { record, count, next: 0, metadata: signature };
    }
    if (
      !fragments ||
      fragments.count !== count ||
      fragments.next !== index ||
      fragments.record.id !== record.id ||
      fragments.record.sequence !== record.sequence ||
      fragments.record.kind !== record.kind ||
      fragments.record.createdAt !== record.createdAt ||
      fragments.metadata !== signature
    )
      return;
    if (index > 0) {
      if (!record.text || fragments.record.text === undefined) return;
      fragments.record.text += record.text;
    }
    fragments.next++;
    if (fragments.next === count) {
      records.push(fragments.record);
      fragments = undefined;
    }
  }
  if (
    fragments ||
    records.length !== body.record_count ||
    new Set(records.map((r) => r.id)).size !== records.length ||
    records.some((r, i) => i > 0 && r.sequence <= records[i - 1]!.sequence)
  )
    return;
  return { ...checkpoint, records };
}
