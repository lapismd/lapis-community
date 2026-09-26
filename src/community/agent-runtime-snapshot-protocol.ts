import type { NostrEvent } from "../protocol/nostr-event.js";
import type { CommunityAgentIdentity } from "./agent-contracts.js";
import {
  agentOwner,
  agentInstance,
  managedAgentOwner,
  signedAgentEvent,
} from "./agent-protocol.js";
import { parseRuntimeState } from "./agent-state-parsers.js";
import type { CommunityAgentRuntimeState } from "./agent-runtime-contracts.js";
export interface RuntimeRefreshRequest {
  version: 1;
  requestId: string;
  requestedAt: number;
  expiresAt: number;
}
export interface RuntimeSnapshot {
  version: 1;
  revision: number;
  observedAt: number;
  runtime: CommunityAgentRuntimeState | null;
  request?: {
    eventId: string;
    requestId: string;
    status: "completed" | "error";
    error?: string;
  };
}
export interface CommunityRuntimeRefreshState {
  status: "idle" | "pending" | "completed" | "error" | "timed-out";
  eventId?: string;
  requestedAt?: number;
  expiresAt?: number;
  observedAt?: number;
  revision?: number;
  error?: string;
}
export function newerRuntimeEvent(
  next: NostrEvent,
  previous?: NostrEvent,
): boolean {
  return (
    !previous ||
    next.created_at > previous.created_at ||
    (next.created_at === previous.created_at && next.id < previous.id)
  );
}
export function validRuntimeEnvelope(
  event: NostrEvent,
  agent: CommunityAgentIdentity,
  owner: string,
  relay?: string,
): boolean {
  const instance = agent.instance?.event;
  const owned =
    agentOwner(agent.profile) === owner ||
    (relay !== undefined &&
      instance !== undefined &&
      agentInstance(instance, owner)?.agentPubkey === agent.pubkey &&
      managedAgentOwner(agent.profile, owner, relay));
  const request = event.kind === 30181,
    peer = request ? agent.pubkey : owner;
  return (
    (request || event.kind === 30180) &&
    !!signedAgentEvent(event) &&
    !!owned &&
    event.pubkey === (request ? owner : agent.pubkey) &&
    event.content.length >= 132 &&
    event.content.length <= 87472 &&
    event.tags.length === 3 &&
    [
      ["p", peer],
      ["d", peer],
      ["agent", agent.pubkey],
    ].every(
      ([key, value]) =>
        event.tags.filter((tag) => tag[0] === key).length === 1 &&
        event.tags.some(
          (tag) => tag.length === 2 && tag[0] === key && tag[1] === value,
        ),
    )
  );
}
export function parseRuntimeRequest(
  value: unknown,
  event: NostrEvent,
): RuntimeRefreshRequest | undefined {
  if (!value || typeof value !== "object") return;
  const v = value as RuntimeRefreshRequest;
  if (
    v.version !== 1 ||
    typeof v.requestId !== "string" ||
    !v.requestId ||
    v.requestId.length > 128 ||
    !Number.isSafeInteger(v.requestedAt) ||
    v.requestedAt < 0 ||
    v.expiresAt !== v.requestedAt + 30000 ||
    Math.floor(v.requestedAt / 1000) !== event.created_at ||
    Object.keys(v).some(
      (key) =>
        !["version", "requestId", "requestedAt", "expiresAt"].includes(key),
    )
  )
    return;
  return v;
}
export function parseRuntimeSnapshot(
  value: unknown,
): RuntimeSnapshot | undefined {
  if (!value || typeof value !== "object") return;
  const v = value as RuntimeSnapshot;
  if (
    v.version !== 1 ||
    !Number.isSafeInteger(v.revision) ||
    v.revision < 1 ||
    !Number.isSafeInteger(v.observedAt) ||
    v.observedAt < 0
  )
    return;
  const runtime =
    v.runtime === null
      ? null
      : parseRuntimeState(v.runtime as unknown as Record<string, unknown>);
  if (runtime === undefined) return;
  const request = v.request;
  if (
    request &&
    (!/^[0-9a-f]{64}$/.test(request.eventId) ||
      typeof request.requestId !== "string" ||
      !request.requestId ||
      request.requestId.length > 128 ||
      !["completed", "error"].includes(request.status))
  )
    return;
  return {
    version: 1,
    revision: v.revision,
    observedAt: v.observedAt,
    runtime,
    ...(request
      ? {
          request: {
            eventId: request.eventId,
            requestId: request.requestId,
            status: request.status,
            ...(typeof request.error === "string"
              ? { error: request.error.slice(0, 512) }
              : {}),
          },
        }
      : {}),
  };
}
