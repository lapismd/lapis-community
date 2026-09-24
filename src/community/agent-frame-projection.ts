import type {
  CommunityAgentsState,
  CommunityAgentObserver,
} from "./agent-contracts.js";
import { ActivityPermissionLedger } from "./activity-sync-permissions.js";
import { AgentPermissionNotices } from "./agent-permission-notices.js";
import { observerRecord, observerText } from "./agent-observer.js";
import { observerScope, controllerScopeId } from "./agent-activity-context.js";
import { activityScopeStorageKey } from "./activity-frame-state.js";
import { projectActivityScope } from "./activity-scope-projection.js";
import { turnFrameIsTerminal } from "./agent-turn-state.js";

/** One sequence-checked projection for live frames, archive replay and signed snapshots. */
export class AgentFrameProjection {
  readonly permissions = new ActivityPermissionLedger();
  readonly sequences = new Map<string, number>();
  readonly notices = new AgentPermissionNotices();
  apply(
    state: CommunityAgentsState,
    agentPubkey: string,
    frame: CommunityAgentObserver,
    nowMs: number,
    observedAt?: number,
    live = false,
  ): Partial<CommunityAgentsState> | undefined {
    const payload = observerRecord(frame.payload);
    const scopeKey = observerText(payload.scopeKey, 4096);
    const sequenceKey = JSON.stringify([
      controllerScopeId(agentPubkey, scopeKey),
      frame.streamId ?? "legacy",
    ]);
    const previousSequence = this.sequences.get(sequenceKey);
    if (previousSequence !== undefined && frame.seq <= previousSequence) return;
    this.sequences.set(sequenceKey, frame.seq);
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
    const scope = projectActivityScope(
      agentPubkey,
      frame,
      state.conversationScopes?.[key],
      (pending ?? state.pendingPermissions)[agentPubkey] ?? [],
      nowMs,
      observedAt,
    );
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
