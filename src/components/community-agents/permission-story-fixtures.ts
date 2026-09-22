import { storyAgent } from "./story-fixtures.js";

export function storyPermissionPatch(expired = false) {
  return {
    activitySyncStatus: "caught-up" as const,
    controllerScopes: {
      [storyAgent.pubkey]: {
        agentPubkey: storyAgent.pubkey,
        scopeKey: "relay/general/agent/thread/root",
        active: true,
        ...(expired ? { state: "waiting_permission" as const } : {}),
        channelId: "general",
        sessionId: "story",
        turnId: "turn",
      },
    },
    pendingPermissions: {
      [storyAgent.pubkey]: [
        {
          agentPubkey: storyAgent.pubkey,
          requestId: expired ? "permission-expired" : "permission-1",
          scopeKey: "relay/general/agent/thread/root",
          tool: "Run test suite",
          input: { command: "pnpm test" },
          options: ["allow_once", "reject_once"] as const,
          expiresAt: expired ? Date.now() - 1 : Date.now() + 15 * 60_000,
          channelId: "general",
          sessionId: "story",
          turnId: "turn",
        },
      ],
    },
  };
}
