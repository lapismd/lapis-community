import type {
  CommunityAgentsState,
  CommunityAgentObserver,
} from "./agent-contracts.js";
import { ActivityPermissionLedger } from "./activity-sync-permissions.js";
import { AgentPermissionNotices } from "./agent-permission-notices.js";
import { observerRecord, observerText } from "./agent-observer.js";
import {
  activityMatches,
  observerScope,
  controllerScopeId,
} from "./agent-activity-context.js";
import { activityScopeStorageKey } from "./activity-frame-state.js";
import { projectActivityScope } from "./activity-scope-state.js";
import { turnFrameIsTerminal, turnIsTerminal } from "./agent-turn-state.js";
import { rejectsFrameOrder, type FrameOrder } from "./agent-frame-order.js";

/** One sequence-checked projection for live frames, archive replay and signed snapshots. */
export class AgentFrameProjection {
  readonly permissions = new ActivityPermissionLedger();
  readonly sequences = new Map<string, FrameOrder>();
  readonly notices = new AgentPermissionNotices();
  apply(
    state: CommunityAgentsState,
    agentPubkey: string,
    frame: CommunityAgentObserver,
    nowMs: number,
    observedAt?: number,
    live = false,
    snapshot = false,
    order = { cursorSeq: frame.seq, recordSeq: frame.seq },
  ): Partial<CommunityAgentsState> | undefined {
    const payload = observerRecord(frame.payload);
    const scopeKey = observerText(payload.scopeKey, 4096);
    const sequenceKey = JSON.stringify([
      controllerScopeId(agentPubkey, scopeKey),
      frame.streamId ?? "legacy",
    ]);
    const previous = this.sequences.get(sequenceKey);
    if (previous && rejectsFrameOrder(previous, order, snapshot)) return;
    this.sequences.set(sequenceKey, order);
    const pending = this.permissions.apply(
      state.pendingPermissions,
      agentPubkey,
      frame,
      nowMs,
    );
    this.notices.observe(agentPubkey, frame, live);
    const requestId =
      observerText(payload.lifecycleRequestId, 512) ||
      observerText(payload.requestId, 512) ||
      frame.turnId ||
      "";
    const key = activityScopeStorageKey(agentPubkey, scopeKey, requestId);
    let scope = projectActivityScope(
      agentPubkey,
      frame,
      state.conversationScopes?.[key],
      (pending ?? state.pendingPermissions)[agentPubkey] ?? [],
      nowMs,
      observedAt,
    );
    if (
      scope &&
      !live &&
      !snapshot &&
      !turnIsTerminal(scope.state) &&
      state.activityUnavailable?.some(
        (target) =>
          target.agentPubkey === agentPubkey &&
          activityMatches(target.context, scope!),
      )
    )
      scope = { ...scope, state: "unknown", preview: "Status unavailable" };
    return {
      ...(pending ? { pendingPermissions: pending } : {}),
      ...(scope
        ? {
            controllerScopes: {
              ...state.controllerScopes,
              [agentPubkey]: scope,
            },
            conversationScopes: { ...state.conversationScopes, [key]: scope },
          }
        : {}),
      ...(turnFrameIsTerminal(frame.kind)
        ? {
            publicWorking: (state.publicWorking ?? []).filter(
              (signal) =>
                !(
                  signal.agentPubkey === agentPubkey &&
                  signal.channelId === frame.channelId &&
                  signal.threadRootId === observerScope(frame).threadRootId
                ),
            ),
          }
        : {}),
    };
  }
}
