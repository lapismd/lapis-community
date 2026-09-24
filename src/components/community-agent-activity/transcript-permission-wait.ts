import {
  turnFrameIsTerminal,
  turnIsTerminal,
} from "../../community/agent-turn-state.js";
import type { CommunityAgentActivityItem } from "../../community/agent-contracts.js";
import { permissionHasExpired } from "../../community/permission-expiry.js";
import { transcriptRequestKey } from "./transcript-request-key.js";

const PERMISSION_WAIT_STALE_MS = 180_000;

type TranscriptProgress = {
  id: string;
  text: string;
  streaming: boolean;
};

/** End a request when it terminates or its permission wait is no longer live. */
export function closeTranscriptProgress(
  item: CommunityAgentActivityItem,
  key: string,
  ended: Set<string>,
  pending: Map<string, TranscriptProgress>,
  activity: readonly CommunityAgentActivityItem[],
  nowMs = Date.now(),
): boolean {
  const payload = record(item.frame.payload);
  const entry = payload.entry as { type?: string; state?: string } | undefined;
  if (
    ended.has(key) ||
    turnIsTerminal(payload.state) ||
    turnFrameIsTerminal(item.frame.kind) ||
    (entry?.type === "turn" && turnIsTerminal(entry.state))
  ) {
    ended.add(key);
    pending.delete(key);
    return true;
  }
  if (
    (item.frame.kind.startsWith("permission_") &&
      item.frame.kind !== "permission_requested") ||
    (isPermissionWait(payload) && !permissionWaitIsLive(item, activity, nowMs))
  ) {
    pending.delete(key);
    return true;
  }
  return false;
}

function isPermissionWait(payload: Record<string, unknown>): boolean {
  return (
    payload.state === "waiting_permission" ||
    payload.preview === "Waiting for your permission"
  );
}

function payloadExpiresAt(
  payload: Record<string, unknown>,
): number | undefined {
  const expiresAt = Number(payload.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > 0 ? expiresAt : undefined;
}

function matchingPermissionRequests(
  item: CommunityAgentActivityItem,
  activity: readonly CommunityAgentActivityItem[],
): CommunityAgentActivityItem[] {
  const payload = record(item.frame.payload);
  const ids = new Set(
    [payload.lifecycleRequestId, payload.requestId, item.frame.turnId].filter(
      (id): id is string => typeof id === "string" && id.length > 0,
    ),
  );
  const key = transcriptRequestKey(item.frame);
  return activity.filter((candidate) => {
    if (candidate.frame.kind !== "permission_requested") return false;
    if (item.frame.turnId && candidate.frame.turnId === item.frame.turnId)
      return true;
    const requestId = record(candidate.frame.payload).requestId;
    if (typeof requestId === "string" && ids.has(requestId)) return true;
    return key !== undefined && transcriptRequestKey(candidate.frame) === key;
  });
}

function permissionWaitIsLive(
  item: CommunityAgentActivityItem,
  activity: readonly CommunityAgentActivityItem[],
  nowMs: number,
): boolean {
  const payload = record(item.frame.payload);
  const statusExpiry = payloadExpiresAt(payload);
  if (
    statusExpiry !== undefined &&
    permissionHasExpired({ expiresAt: statusExpiry }, nowMs)
  )
    return false;
  const matches = matchingPermissionRequests(item, activity);
  if (
    matches.some((candidate) => {
      const expiry = payloadExpiresAt(record(candidate.frame.payload));
      return (
        expiry !== undefined &&
        !permissionHasExpired({ expiresAt: expiry }, nowMs)
      );
    })
  )
    return true;
  if (
    matches.some((candidate) => {
      const expiry = payloadExpiresAt(record(candidate.frame.payload));
      return (
        expiry !== undefined &&
        permissionHasExpired({ expiresAt: expiry }, nowMs)
      );
    })
  )
    return false;
  return item.createdAt * 1_000 + PERMISSION_WAIT_STALE_MS > nowMs;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
