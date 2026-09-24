import type {
  CommunityAgentControllerScope,
  CommunityAgentPermissionRequest,
  CommunityAgentsState,
} from "./agent-contracts.js";

export function permissionHasExpired(
  permission: Pick<CommunityAgentPermissionRequest, "expiresAt">,
  nowMs: number,
): boolean {
  return (
    typeof permission.expiresAt === "number" &&
    Number.isFinite(permission.expiresAt) &&
    permission.expiresAt <= nowMs
  );
}

export function livePendingPermissions(
  permissions: readonly CommunityAgentPermissionRequest[],
  nowMs: number,
): CommunityAgentPermissionRequest[] {
  return permissions.filter(
    (permission) => !permissionHasExpired(permission, nowMs),
  );
}

export function sweepExpiredPermissionState(
  state: Pick<
    CommunityAgentsState,
    "pendingPermissions" | "controllerScopes" | "conversationScopes"
  >,
  nowMs: number,
):
  | Pick<
      CommunityAgentsState,
      "pendingPermissions" | "controllerScopes" | "conversationScopes"
    >
  | undefined {
  const pendingPermissions = Object.fromEntries(
    Object.entries(state.pendingPermissions).map(([pubkey, permissions]) => [
      pubkey,
      livePendingPermissions(permissions, nowMs),
    ]),
  );
  const controllerScopes = expireWaitingScopes(
    state.controllerScopes,
    pendingPermissions,
    nowMs,
  );
  const conversationScopes = expireWaitingScopes(
    state.conversationScopes ?? {},
    pendingPermissions,
    nowMs,
  );
  if (
    samePermissionMap(state.pendingPermissions, pendingPermissions) &&
    sameScopeMap(state.controllerScopes, controllerScopes) &&
    sameScopeMap(state.conversationScopes ?? {}, conversationScopes)
  )
    return;
  return {
    pendingPermissions,
    controllerScopes,
    conversationScopes,
  };
}

function expireWaitingScopes(
  scopes: Readonly<Record<string, CommunityAgentControllerScope>>,
  pending: Readonly<Record<string, readonly CommunityAgentPermissionRequest[]>>,
  nowMs: number,
): Record<string, CommunityAgentControllerScope> {
  const next: Record<string, CommunityAgentControllerScope> = {};
  for (const [key, scope] of Object.entries(scopes)) {
    if (scope.state !== "waiting_permission") {
      next[key] = scope;
      continue;
    }
    const live = (pending[scope.agentPubkey] ?? []).some(
      (permission) =>
        permission.scopeKey === scope.scopeKey &&
        (!scope.sessionId || permission.sessionId === scope.sessionId) &&
        (!scope.turnId || permission.turnId === scope.turnId) &&
        !permissionHasExpired(permission, nowMs),
    );
    if (live) {
      next[key] = scope;
      continue;
    }
    next[key] = {
      ...scope,
      active: true,
      state: "unknown",
      preview: "Permission expired. Waiting for controller status.",
      updatedAt: nowMs,
    };
  }
  return next;
}

function samePermissionMap(
  left: Readonly<Record<string, readonly CommunityAgentPermissionRequest[]>>,
  right: Readonly<Record<string, readonly CommunityAgentPermissionRequest[]>>,
): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    const leftList = left[key] ?? [];
    const rightList = right[key] ?? [];
    if (
      leftList.length !== rightList.length ||
      leftList.some(
        (permission, index) =>
          permission.requestId !== rightList[index]?.requestId,
      )
    )
      return false;
  }
  return true;
}

function sameScopeMap(
  left: Readonly<Record<string, CommunityAgentControllerScope>>,
  right: Readonly<Record<string, CommunityAgentControllerScope>>,
): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    const leftScope = left[key];
    const rightScope = right[key];
    if (
      leftScope?.active !== rightScope?.active ||
      leftScope?.state !== rightScope?.state ||
      leftScope?.updatedAt !== rightScope?.updatedAt
    )
      return false;
  }
  return true;
}
