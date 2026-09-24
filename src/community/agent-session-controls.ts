import type {
  CommunityAgentControl,
  CommunityAgentsState,
  CommunityAgentControllerScope,
} from "./agent-contracts.js";
export function selectedControllerScope(
  state: CommunityAgentsState,
  agentPubkey: string,
  scopeKey: string,
  expected?: { requestId?: string; sessionId: string; turnId: string },
  idleSession = false,
): CommunityAgentControllerScope {
  const scopes = Object.values(state.conversationScopes ?? {});
  const fallback = state.controllerScopes[agentPubkey];
  if (fallback) scopes.push(fallback);
  const candidates = scopes.filter(
    (scope) =>
      scope.agentPubkey === agentPubkey &&
      scope.scopeKey === scopeKey &&
      (!expected ||
        (scope.sessionId === expected.sessionId &&
          (idleSession || (scope.turnId ?? "") === expected.turnId) &&
          (!expected.requestId || scope.requestId === expected.requestId))),
  );
  if (idleSession && candidates.some((scope) => scope.active))
    throw new Error("The displayed conversation has changed");
  const unique = new Map(
    candidates.map((scope) => [
      JSON.stringify([
        ...(expected?.requestId ? [scope.requestId] : []),
        scope.sessionId,
        ...(idleSession ? [] : [scope.turnId]),
      ]),
      scope,
    ]),
  );
  if (unique.size !== 1)
    throw new Error(
      "The displayed turn is no longer available. Refresh activity and select the exact turn.",
    );
  return [...unique.values()][0]!;
}

export function sessionControl(
  state: CommunityAgentsState,
  pubkey: string,
  command: "cancel_turn" | "reset_conversation",
  scopeKey: string,
  channelId?: string,
  expected?: { requestId?: string; sessionId: string; turnId: string },
): CommunityAgentControl {
  const reset = command === "reset_conversation";
  const scope = selectedControllerScope(
    state,
    pubkey,
    scopeKey,
    expected,
    reset && expected?.turnId === "",
  );
  if (!reset && !scope.active)
    throw new Error("No active controller turn is available to cancel");
  if (
    reset &&
    expected &&
    (scope.sessionId !== expected.sessionId ||
      (scope.active ? (scope.turnId ?? "") : "") !== expected.turnId)
  )
    throw new Error("The displayed conversation has changed");
  return {
    version: 1,
    command,
    scopeKey,
    ...(scope.sessionId ? { expectedSessionId: scope.sessionId } : {}),
    expectedTurnId:
      expected?.turnId ?? (scope.active ? (scope.turnId ?? "") : ""),
    ...(channelId ? { channelId } : {}),
  };
}
