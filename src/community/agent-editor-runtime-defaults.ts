import type { CommunityAgentRuntimeState } from "./agent-runtime-contracts.js";

export function editorRuntimeDefaultRows(
  runtime: CommunityAgentRuntimeState,
  labels: { harness: string; model: string; thinking: string },
): { label: string; value: string }[] {
  return [
    { label: "Harness", value: labels.harness },
    { label: "Model", value: labels.model },
    { label: "Thinking", value: labels.thinking },
    { label: "Host", value: runtime.host.id },
    ...(runtime.host.workspace
      ? [{ label: "Workspace", value: runtime.host.workspace }]
      : []),
    ...(runtime.bootstrapRevision
      ? [{ label: "Bootstrap", value: runtime.bootstrapRevision }]
      : []),
  ];
}
