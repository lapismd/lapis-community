import type { CommunityAgentRuntimeState } from "./agent-runtime-contracts.js";
import {
  resolveRuntimeCatalog,
  runtimeModelOptions,
  runtimeSelectionForCatalog,
  runtimeThinkingOptions,
} from "./agent-runtime-catalog.js";

export function editorRuntimeDraft(
  runtime: CommunityAgentRuntimeState | undefined,
  runtimeAgent: string,
  current: { model?: string; thinking?: string },
) {
  const advertised = runtime?.runtimeAgents.find(
    (entry) => entry.id === runtimeAgent,
  );
  const catalog =
    advertised && !advertised.catalog
      ? { agent: runtimeAgent, models: [], configOptions: [] }
      : resolveRuntimeCatalog(runtime, runtimeAgent);
  const selection = runtimeSelectionForCatalog(catalog, current);
  const modelOptions = runtimeModelOptions(catalog);
  return {
    catalog,
    selection,
    modelOptions,
    thinkingOptions: runtimeThinkingOptions(catalog, selection.model),
    modelTriggerLabel:
      modelOptions.find((option) => option.value === selection.model)?.name ??
      (selection.model ||
        (catalog?.error ? "No models for this harness" : "Loading models…")),
  };
}
