import type { CommunityAgentRuntimeState } from "./agent-runtime-contracts.js";
import {
  resolveRuntimeCatalog,
  runtimeHarnesses,
  runtimeModelOptions,
  runtimeOptionLabel,
  runtimeThinkingOptions,
} from "./agent-runtime-catalog.js";

export function editorConfiguredRuntimeLabels(
  runtime: CommunityAgentRuntimeState | undefined,
) {
  const runtimeAgents = runtimeHarnesses(runtime);
  const configuredCatalog = resolveRuntimeCatalog(
    runtime,
    runtime?.configured.runtimeAgent ?? "",
  );
  return {
    runtimeAgents,
    configuredCatalog,
    harness:
      runtimeAgents.find(({ id }) => id === runtime?.configured.runtimeAgent)
        ?.label ??
      runtime?.configured.runtimeAgent ??
      runtime?.catalog.agent ??
      runtime?.effective.runtimeAgent ??
      "Harness default",
    model: runtimeOptionLabel(
      runtimeModelOptions(configuredCatalog),
      runtime?.configured.model ?? configuredCatalog?.currentModel,
      "Harness default",
    ),
    thinking: runtimeOptionLabel(
      runtimeThinkingOptions(configuredCatalog),
      runtime?.configured.thinking ?? runtime?.effective.thinking,
      "Harness default",
    ),
  };
}
