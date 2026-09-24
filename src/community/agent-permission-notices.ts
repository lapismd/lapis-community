import type {
  CommunityAgentActivityContext,
  CommunityAgentObserver,
  CommunityAgentPermissionRequest,
  CommunityAgentsState,
} from "./agent-contracts.js";
import { contextForScope, observerScope } from "./agent-activity-context.js";
import { permissionHasExpired } from "./permission-expiry.js";
import { observerRecord, observerText } from "./agent-observer.js";

export interface AgentPermissionNotice extends CommunityAgentPermissionRequest {
  key: string;
  context: CommunityAgentActivityContext;
}
export const permissionNoticeKey = (
  request: Pick<
    CommunityAgentPermissionRequest,
    "agentPubkey" | "requestId" | "sessionId" | "turnId"
  >,
) =>
  JSON.stringify([
    request.agentPubkey,
    request.requestId,
    request.sessionId,
    request.turnId,
  ]);

/** Claims survive view remounts. First-seen replay never becomes a new notification. */
export class AgentPermissionNotices {
  readonly #seen = new Set<string>();
  readonly #eligible = new Map<string, CommunityAgentActivityContext>();
  observe(agentPubkey: string, frame: CommunityAgentObserver, live: boolean) {
    if (frame.kind !== "permission_requested") return;
    const requestId = observerText(
      observerRecord(frame.payload).requestId,
      512,
    );
    if (!requestId) return;
    const key = permissionNoticeKey({
      agentPubkey,
      requestId,
      ...(frame.sessionId ? { sessionId: frame.sessionId } : {}),
      ...(frame.turnId ? { turnId: frame.turnId } : {}),
    });
    if (this.#seen.has(key)) return;
    // Fail closed at the bound rather than evicting identities and replaying old toasts.
    if (this.#seen.size >= 8192) return;
    this.#seen.add(key);
    if (!live) return;
    this.#eligible.set(key, {
      ...contextForScope({
        agentPubkey,
        scopeKey: "",
        active: true,
        ...observerScope(frame),
      }),
      ...(frame.turnId ? { focusTurnId: frame.turnId } : {}),
    });
  }
  take(state: CommunityAgentsState, nowMs: number): AgentPermissionNotice[] {
    const notices: AgentPermissionNotice[] = [];
    for (const request of Object.values(state.pendingPermissions).flat()) {
      const key = permissionNoticeKey(request),
        context = this.#eligible.get(key);
      if (context && !permissionHasExpired(request, nowMs))
        notices.push({ ...request, key, context });
    }
    this.#eligible.clear();
    return notices;
  }
}
