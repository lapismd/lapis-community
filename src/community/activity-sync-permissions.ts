import type {
  CommunityAgentObserver,
  CommunityAgentPermissionDecision,
  CommunityAgentPermissionRequest,
} from "./agent-contracts.js";
import { observerRecord, observerText } from "./agent-observer.js";
import { permissionHasExpired } from "./permission-expiry.js";
import { turnFrameIsTerminal, turnIsTerminal } from "./agent-turn-state.js";

export const permissionSettled = (kind: string): boolean =>
  [
    "permission_resolved",
    "permission_expired",
    "permission_cancelled",
  ].includes(kind);

/** Terminal identities survive navigation and out-of-order snapshot delivery. */
export class ActivityPermissionLedger {
  #settled = new Set<string>();
  #ended = new Set<string>();

  apply(
    pending: Readonly<
      Record<string, readonly CommunityAgentPermissionRequest[]>
    >,
    agent: string,
    frame: CommunityAgentObserver,
    nowMs: number,
  ): Record<string, readonly CommunityAgentPermissionRequest[]> | undefined {
    const payload = observerRecord(frame.payload);
    const identity = JSON.stringify([agent, payload.requestId]);
    const turn = JSON.stringify([agent, frame.sessionId, frame.turnId]);
    if (permissionSettled(frame.kind)) this.#remember(this.#settled, identity);
    if (turnFrameIsTerminal(frame.kind) || turnIsTerminal(payload.state))
      this.#remember(this.#ended, turn);
    if (frame.kind === "permission_requested") {
      if (this.#settled.has(identity) || this.#ended.has(turn)) return;
      const request = controllerPermission(agent, frame, payload);
      if (request && permissionHasExpired(request, nowMs)) {
        this.#remember(this.#settled, identity);
        return;
      }
    }
    return applyPermissionCards(pending, agent, frame, nowMs);
  }

  snapshot(
    agent: string,
    frames: readonly CommunityAgentObserver[],
    nowMs: number,
  ): CommunityAgentPermissionRequest[] {
    let pending: Record<string, readonly CommunityAgentPermissionRequest[]> =
      {};
    for (const frame of frames.toSorted((a, b) => a.seq - b.seq))
      pending = this.apply(pending, agent, frame, nowMs) ?? pending;
    return [...(pending[agent] ?? [])];
  }

  #remember(set: Set<string>, value: string): void {
    set.add(value);
    if (set.size > 4096) set.delete(set.values().next().value!);
  }
}

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
  return new ActivityPermissionLedger().snapshot(agentPubkey, frames, nowMs);
}

export function applyPermissionCards(
  pending: Readonly<Record<string, readonly CommunityAgentPermissionRequest[]>>,
  agentPubkey: string,
  frame: Pick<
    CommunityAgentObserver,
    "kind" | "channelId" | "sessionId" | "turnId" | "payload"
  >,
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
  if (permissionSettled(frame.kind)) {
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
    (turnFrameIsTerminal(frame.kind) ||
      turnIsTerminal(observerRecord(frame.payload).state)) &&
    frame.turnId
  ) {
    return {
      ...pending,
      [agentPubkey]: (pending[agentPubkey] ?? []).filter(
        (request) =>
          request.turnId !== frame.turnId ||
          request.sessionId !== frame.sessionId,
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
