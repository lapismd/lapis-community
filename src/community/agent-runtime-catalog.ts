import type {
  CommunityAgentRuntimeAgent,
  CommunityAgentRuntimeCatalog,
  CommunityAgentRuntimeOption,
  CommunityAgentRuntimeState,
  CommunityAgentRuntimeThinking,
} from "./agent-runtime-contracts.js";
import {
  parseRuntimeAgents,
  parseRuntimeCatalog,
} from "./agent-runtime-catalog-parse.js";
import {
  isRuntimeThinking,
  runtimeThinkingCurrent,
  runtimeThinkingOptions,
} from "./agent-runtime-thinking.js";

export { parseRuntimeAgents, parseRuntimeCatalog };
export { runtimeThinkingOptions };

export function runtimeHarnesses(
  runtime?: CommunityAgentRuntimeState,
): readonly CommunityAgentRuntimeAgent[] {
  if (runtime?.runtimeAgents.length) return runtime.runtimeAgents;
  return runtime
    ? [
        {
          id: runtime.effective.runtimeAgent,
          label: runtime.effective.runtimeAgent,
          catalog: runtime.catalog,
        },
      ]
    : [];
}

export function resolveRuntimeCatalog(
  runtime: CommunityAgentRuntimeState | undefined,
  runtimeAgent: string,
): CommunityAgentRuntimeCatalog | undefined {
  if (!runtime || !runtimeAgent) return;
  const advertised = runtime.runtimeAgents.find(
    (entry) => entry.id === runtimeAgent,
  );
  if (advertised?.catalog) return advertised.catalog;
  if (runtime.catalog.agent === runtimeAgent) return runtime.catalog;
  if (advertised) return { agent: runtimeAgent, models: [], configOptions: [] };
  return {
    agent: runtimeAgent,
    models: [],
    configOptions: [],
    error: "Runtime catalog unavailable for this harness",
  };
}

export function runtimeModelOptions(
  catalog?: CommunityAgentRuntimeCatalog,
): readonly CommunityAgentRuntimeOption[] {
  const option = catalog?.configOptions.find(
    ({ id, category }) => id === "model" || category === "model",
  );
  if (option?.options) return option.options;
  if (catalog?.entries?.length)
    return catalog.entries.map((entry) => ({
      value: entry.id,
      name: entry.label || entry.id,
    }));
  return catalog?.models.map((value) => ({ value, name: value })) ?? [];
}

export function runtimeOptionLabel(
  options: readonly CommunityAgentRuntimeOption[],
  value: string | undefined,
  fallback: string,
): string {
  return (
    (options.find((option) => option.value === value)?.name ??
      value ??
      fallback) ||
    fallback
  );
}

export function runtimeCatalogDefaults(
  catalog?: CommunityAgentRuntimeCatalog,
  model?: string,
): {
  model: string;
  thinking?: CommunityAgentRuntimeThinking;
} {
  const models = runtimeModelOptions(catalog);
  const selected =
    (model && models.some((option) => option.value === model)
      ? model
      : undefined) ??
    (catalog?.currentModel &&
    models.some((option) => option.value === catalog.currentModel)
      ? catalog.currentModel
      : models[0]?.value) ??
    "";
  const thinking = runtimeThinkingOptions(catalog, selected);
  const thinkingCurrent = runtimeThinkingCurrent(catalog, selected);
  const nextThinking =
    typeof thinkingCurrent === "string" &&
    thinking.some((option) => option.value === thinkingCurrent)
      ? thinkingCurrent
      : thinking[0]?.value;
  return {
    model: selected,
    ...(nextThinking && isRuntimeThinking(nextThinking)
      ? { thinking: nextThinking }
      : {}),
  };
}

export function runtimeSelectionForCatalog(
  catalog: CommunityAgentRuntimeCatalog | undefined,
  current: { model?: string; thinking?: string } = {},
): { model: string; thinking?: CommunityAgentRuntimeThinking } {
  const defaults = runtimeCatalogDefaults(catalog, current.model);
  const models = runtimeModelOptions(catalog);
  const thinking = runtimeThinkingOptions(catalog, defaults.model);
  const nextThinking =
    current.thinking &&
    thinking.some((option) => option.value === current.thinking)
      ? current.thinking
      : defaults.thinking;
  return {
    model:
      current.model && models.some((option) => option.value === current.model)
        ? current.model
        : defaults.model,
    ...(nextThinking && isRuntimeThinking(nextThinking)
      ? { thinking: nextThinking }
      : {}),
  };
}
