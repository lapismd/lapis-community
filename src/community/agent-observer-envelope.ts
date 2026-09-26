import type {
  CommunityAgentActivityItem,
  CommunityAgentObserver,
} from "./agent-contracts.js";
import { agentJson, parseAgentObserver } from "./agent-protocol.js";

const MAX_BATCH_RECORDS = 20;
const MAX_BATCH_BYTES = 24 * 1_024;
const PROGRESS_KINDS = new Set([
  "assistant_message_chunk",
  "thinking_chunk",
  "plan_updated",
  "tool_call_update",
  "request_status",
  "runtime_policy",
  "turn_started",
]);

export interface AgentObserverEnvelopeRecord {
  id?: string;
  cursorSeq: number;
  frame: CommunityAgentObserver;
}

export interface AgentObserverEnvelope {
  batched: boolean;
  cursorSeq: number;
  streamId?: string;
  records: readonly AgentObserverEnvelopeRecord[];
}

export function observerEnvelopeActivityItems(
  eventId: string,
  agentPubkey: string,
  createdAt: number,
  envelope: AgentObserverEnvelope,
  outerChannel?: string,
): CommunityAgentActivityItem[] {
  return envelope.records.map(({ id, frame }) => ({
    id: id ? `${eventId}:${id}` : eventId,
    agentPubkey,
    createdAt,
    frame: {
      ...frame,
      ...((frame.channelId ?? outerChannel)
        ? { channelId: (frame.channelId ?? outerChannel)! }
        : {}),
    },
  }));
}

/** Decode one encrypted telemetry payload without persisting expanded records. */
export function parseAgentObserverEnvelope(
  plaintext: string,
): AgentObserverEnvelope | undefined {
  const single = parseAgentObserver(plaintext);
  if (single)
    return {
      batched: false,
      cursorSeq: single.seq,
      ...(single.streamId ? { streamId: single.streamId } : {}),
      records: [{ cursorSeq: single.seq, frame: single }],
    };
  const outer = agentJson(plaintext);
  if (
    outer.version !== 3 ||
    outer.kind !== "batch" ||
    !safeSequence(outer.seq) ||
    !validTimestamp(outer.timestamp) ||
    !validOptionalText(outer.streamId, 128, false) ||
    !validOptionalText(outer.channelId, 4_096) ||
    !validOptionalText(outer.sessionId, 4_096) ||
    !validOptionalText(outer.turnId, 4_096) ||
    !Array.isArray(outer.records) ||
    outer.records.length === 0 ||
    outer.records.length > MAX_BATCH_RECORDS
  )
    return;
  const ids = new Set<string>();
  const records: AgentObserverEnvelopeRecord[] = [];
  let recordBytes = 0;
  for (const value of outer.records) {
    if (!record(value)) return;
    recordBytes += new TextEncoder().encode(JSON.stringify(value)).byteLength;
    if (recordBytes > MAX_BATCH_BYTES) return;
    if (ids.has(value.id)) return;
    ids.add(value.id);
    records.push({
      id: value.id,
      cursorSeq: outer.seq as number,
      frame: {
        version: 2,
        seq: value.seq,
        ...(typeof outer.streamId === "string"
          ? { streamId: outer.streamId }
          : {}),
        timestamp: value.timestamp,
        kind: value.kind,
        ...(typeof outer.channelId === "string"
          ? { channelId: outer.channelId }
          : {}),
        ...(typeof value.sessionId === "string"
          ? { sessionId: value.sessionId }
          : typeof outer.sessionId === "string"
            ? { sessionId: outer.sessionId }
            : {}),
        ...(typeof value.turnId === "string"
          ? { turnId: value.turnId }
          : typeof outer.turnId === "string"
            ? { turnId: outer.turnId }
            : {}),
        payload: value.payload,
      },
    });
  }
  records.sort(
    (left, right) =>
      left.frame.seq - right.frame.seq || left.id!.localeCompare(right.id!),
  );
  return {
    batched: true,
    cursorSeq: outer.seq as number,
    ...(typeof outer.streamId === "string" ? { streamId: outer.streamId } : {}),
    records,
  };
}

function record(value: unknown): value is {
  id: string;
  seq: number;
  timestamp: string;
  kind: string;
  sessionId?: string;
  turnId?: string;
  payload: Record<string, unknown>;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    candidate.id.length <= 512 &&
    safeSequence(candidate.seq) &&
    validTimestamp(candidate.timestamp) &&
    typeof candidate.kind === "string" &&
    PROGRESS_KINDS.has(candidate.kind) &&
    validOptionalText(candidate.sessionId, 4_096) &&
    validOptionalText(candidate.turnId, 4_096) &&
    !!candidate.payload &&
    typeof candidate.payload === "object" &&
    !Array.isArray(candidate.payload)
  );
}

function safeSequence(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function validOptionalText(
  value: unknown,
  maximum: number,
  allowNull = true,
): boolean {
  return (
    value === undefined ||
    (allowNull && value === null) ||
    (typeof value === "string" && value.length > 0 && value.length <= maximum)
  );
}
