import type { CommunityAgentRuntimeState } from "./agent-runtime-contracts.js";

export function editorRuntimeLoadKey(
  runtime: CommunityAgentRuntimeState,
): string {
  return [
    runtime.agentId,
    runtime.saved?.updatedAt ?? "defaults",
    runtime.effective.runtimeAgent,
    runtime.effective.model ?? "",
    runtime.effective.thinking ?? "",
    runtime.effective.permissionMode ?? "",
    runtime.effective.approvalPolicy ?? "legacy",
  ].join(":");
}
