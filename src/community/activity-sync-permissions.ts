import type {
  CommunityAgentObserver,
  CommunityAgentPermissionDecision,
  CommunityAgentPermissionRequest,
} from "./agent-contracts.js";
import { observerRecord, observerText } from "./agent-observer.js";
import { permissionHasExpired } from "./permission-expiry.js";

const CONTROLLER_PERMISSION_DECISIONS =
  new Set<CommunityAgentPermissionDecision>([
    "allow_once",
    "allow_always",
    "reject_once",
    "reject_always",
    "cancel",
  ]);

export function controllerPermission(
  agentPubkey: string,
  frame: Pick<
    CommunityAgentObserver,
    "channelId" | "sessionId" | "turnId" | "payload"
  >,
  payload: Record<string, unknown>,
): CommunityAgentPermissionRequest | undefined {
  const requestId = observerText(payload.requestId, 512);
  const scopeKey = observerText(payload.scopeKey, 4_096);
  const tool = observerText(payload.tool, 512);
  const options = Array.isArray(payload.options)
    ? [
        ...new Set(
          payload.options.filter(
            (value): value is CommunityAgentPermissionDecision =>
              typeof value === "string" &&
              CONTROLLER_PERMISSION_DECISIONS.has(
                value as CommunityAgentPermissionDecision,
              ),
          ),
        ),
      ]
    : [];
  if (!requestId || !scopeKey || !tool || options.length === 0) return;
  const expiresAt = Number(payload.expiresAt);
  return {
    agentPubkey,
    requestId,
    scopeKey,
    tool,
    ...(payload.input === undefined ? {} : { input: payload.input }),
    options,
    ...(Number.isSafeInteger(expiresAt) && expiresAt > 0 ? { expiresAt } : {}),
    ...(frame.channelId ? { channelId: frame.channelId } : {}),
    ...(frame.sessionId ? { sessionId: frame.sessionId } : {}),
    ...(frame.turnId ? { turnId: frame.turnId } : {}),
  };
}

export function snapshotPermissionRequests(
  agentPubkey: string,
  frames: readonly CommunityAgentObserver[],
  nowMs = Date.now(),
): CommunityAgentPermissionRequest[] {
  const requests = new Map<string, CommunityAgentPermissionRequest>();
  for (const frame of frames) {
    if (frame.kind !== "permission_requested") continue;
    const request = controllerPermission(
      agentPubkey,
      frame,
      observerRecord(frame.payload),
    );
    if (request && !permissionHasExpired(request, nowMs))
      requests.set(request.requestId, request);
  }
  return [...requests.values()];
}

export function applyPermissionCards(
  pending: Readonly<Record<string, readonly CommunityAgentPermissionRequest[]>>,
  agentPubkey: string,
  frame: Pick<CommunityAgentObserver, "kind" | "turnId" | "payload">,
  nowMs: number,
): Record<string, readonly CommunityAgentPermissionRequest[]> | undefined {
  if (frame.kind === "permission_requested") {
    const request = controllerPermission(
      agentPubkey,
      frame,
      observerRecord(frame.payload),
    );
    if (!request || permissionHasExpired(request, nowMs)) return;
    const current = pending[agentPubkey] ?? [];
    return {
      ...pending,
      [agentPubkey]: [
        ...current.filter(
          (candidate) => candidate.requestId !== request.requestId,
        ),
        request,
      ].slice(-32),
    };
  }
  if (frame.kind === "permission_resolved") {
    const requestId = observerText(
      observerRecord(frame.payload).requestId,
      512,
    );
    if (!requestId) return;
    return {
      ...pending,
      [agentPubkey]: (pending[agentPubkey] ?? []).filter(
        (request) => request.requestId !== requestId,
      ),
    };
  }
  if (
    [
      "turn_completed",
      "turn_finished",
      "turn_failed",
      "turn_cancelled",
    ].includes(frame.kind) &&
    frame.turnId
  ) {
    return {
      ...pending,
      [agentPubkey]: (pending[agentPubkey] ?? []).filter(
        (request) => request.turnId !== frame.turnId,
      ),
    };
  }
  return;
}

export function replaceScopePendingPermissions(
  pending: Readonly<Record<string, readonly CommunityAgentPermissionRequest[]>>,
  agentPubkey: string,
  scopeKey: string,
  replacements: readonly CommunityAgentPermissionRequest[],
): Record<string, readonly CommunityAgentPermissionRequest[]> {
  return {
    ...pending,
    [agentPubkey]: [
      ...(pending[agentPubkey] ?? []).filter(
        (permission) => permission.scopeKey !== scopeKey,
      ),
      ...replacements,
    ],
  };
}
