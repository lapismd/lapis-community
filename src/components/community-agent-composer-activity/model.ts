import { turnStateLabel } from "../../community/agent-turn-state.js";
import {
  activityMatches,
  contextForScope,
} from "../../community/agent-activity-context.js";
import type {
  CommunityAgentActivityContext,
  CommunityAgentsState,
} from "../../community/agent-contracts.js";
export function composerActivity(
  model: CommunityAgentsState | undefined,
  context: CommunityAgentActivityContext,
  now: number,
) {
  if (!model || model.status !== "ready") return [];
  const privateEntries = Object.values(model.conversationScopes ?? {})
    .filter(
      (scope) =>
        activityMatches(context, scope) &&
        scope.updatedAt !== undefined &&
        scope.updatedAt <= now + 30_000 &&
        ((scope.active && scope.updatedAt + 180_000 > now) ||
          scope.state === "failed"),
    )
    .flatMap((scope) => {
      const agent = [...model.agents, ...(model.publicAgents ?? [])].find(
        (agent) => agent.pubkey === scope.agentPubkey,
      );
      if (!agent) return [];
      return [
        {
          key: [scope.agentPubkey, scope.scopeKey, scope.requestId].join(),
          agentPubkey: scope.agentPubkey,
          name: agent.name,
          avatarUrl: agent.avatarUrl,
          preview:
            scope.state === "waiting_permission"
              ? "Waiting for your permission"
              : scope.preview || turnStateLabel(scope.state),
          context: {
            ...contextForScope(scope),
            ...(scope.turnId ? { focusTurnId: scope.turnId } : {}),
          },
          canOpen: true,
          updatedAt: scope.updatedAt!,
          severity: scope.severity ?? "info",
          state: scope.state ?? "unknown",
        },
      ];
    });
  const publicEntries = (model.publicWorking ?? [])
    .filter(
      (signal) =>
        signal.expiresAt * 1000 > now &&
        activityMatches(context, signal) &&
        !privateEntries.some(
          (entry) =>
            entry.agentPubkey === signal.agentPubkey &&
            "channelId" in entry.context &&
            entry.context.channelId === signal.channelId,
        ),
    )
    .map((signal) => {
      const agent = [...model.agents, ...(model.publicAgents ?? [])].find(
        (agent) => agent.pubkey === signal.agentPubkey,
      );
      return {
        key: JSON.stringify(signal),
        agentPubkey: signal.agentPubkey,
        name: agent?.name ?? "Agent",
        avatarUrl: agent?.avatarUrl,
        preview: "Working",
        context: { kind: "channel" as const, channelId: signal.channelId },
        canOpen: false,
        updatedAt: signal.expiresAt * 1000,
        severity: "info",
        state: "running",
      };
    });
  return [...privateEntries, ...publicEntries].sort(
    (a, b) =>
      Number(b.state === "waiting_permission") -
        Number(a.state === "waiting_permission") ||
      b.updatedAt - a.updatedAt ||
      a.key.localeCompare(b.key),
  );
}
