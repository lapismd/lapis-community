import type {
  CommunityAgentRuntimeAgent,
  CommunityAgentRuntimeCatalog,
  CommunityAgentRuntimeOption,
  CommunityAgentRuntimeState,
  CommunityAgentRuntimeThinking,
} from "./agent-runtime-contracts.js";
import { observerRecord, observerText } from "./agent-observer.js";

const THINKING_VALUES = new Set<CommunityAgentRuntimeThinking>([
  "off",
  "low",
  "medium",
  "high",
]);

export function parseRuntimeCatalog(
  value: unknown,
): CommunityAgentRuntimeCatalog | undefined {
  const catalog = observerRecord(value);
  const agent = observerText(catalog.agent, 256);
  if (!agent) return;
  const configOptions = Array.isArray(catalog.configOptions)
    ? catalog.configOptions.flatMap((entry) => {
        const item = observerRecord(entry);
        const id = observerText(item.id, 256);
        const name = observerText(item.name, 256);
        if (!id || !name) return [];
        const options = Array.isArray(item.options)
          ? item.options.flatMap((option) => {
              const candidate = observerRecord(option);
              const optionValue = observerText(candidate.value, 256);
              const optionName = observerText(candidate.name, 256);
              return optionValue && optionName
                ? [
                    {
                      value: optionValue,
                      name: optionName,
                      ...(observerText(candidate.description, 1_024)
                        ? {
                            description: observerText(
                              candidate.description,
                              1_024,
                            ),
                          }
                        : {}),
                    },
                  ]
                : [];
            })
          : undefined;
        return [
          {
            id,
            name,
            ...(observerText(item.category, 64)
              ? { category: observerText(item.category, 64) }
              : {}),
            ...(typeof item.currentValue === "string" ||
            typeof item.currentValue === "boolean"
              ? { currentValue: item.currentValue }
              : {}),
            ...(options ? { options } : {}),
          },
        ];
      })
    : [];
  return {
    agent,
    ...(observerText(catalog.currentModel, 256)
      ? { currentModel: observerText(catalog.currentModel, 256) }
      : {}),
    models: Array.isArray(catalog.models)
      ? catalog.models.map((model) => observerText(model, 256)).filter(Boolean)
      : [],
    configOptions,
    ...(observerText(catalog.error, 1_024)
      ? { error: observerText(catalog.error, 1_024) }
      : {}),
  };
}

export function parseRuntimeAgents(
  value: unknown,
): CommunityAgentRuntimeAgent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const item = observerRecord(entry);
    const id = observerText(item.id, 256);
    const label = observerText(item.label, 256);
    if (!id || !label) return [];
    const catalog = parseRuntimeCatalog(item.catalog);
    return [
      {
        id,
        label,
        ...(observerText(item.mcpTransport, 32)
          ? { mcpTransport: observerText(item.mcpTransport, 32) }
          : {}),
        ...(catalog ? { catalog } : {}),
      },
    ];
  });
}

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
  )?.catalog;
  if (advertised) return advertised;
  if (runtime.catalog.agent === runtimeAgent) return runtime.catalog;
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
  return (
    option?.options ??
    catalog?.models.map((value) => ({ value, name: value })) ??
    []
  );
}

export function runtimeThinkingOptions(
  catalog?: CommunityAgentRuntimeCatalog,
): readonly CommunityAgentRuntimeOption[] {
  const option = catalog?.configOptions.find(
    ({ id, category }) =>
      category === "thought" ||
      ["thought_level", "thinking", "effort", "reasoning_effort"].includes(id),
  );
  return (
    option?.options?.filter((candidate) =>
      THINKING_VALUES.has(candidate.value as CommunityAgentRuntimeThinking),
    ) ?? []
  );
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
): {
  model: string;
  thinking: CommunityAgentRuntimeThinking;
} {
  const models = runtimeModelOptions(catalog);
  const thinking = runtimeThinkingOptions(catalog);
  const thinkingCurrent = catalog?.configOptions.find(
    ({ id, category }) =>
      category === "thought" ||
      ["thought_level", "thinking", "effort", "reasoning_effort"].includes(id),
  )?.currentValue;
  const model =
    (catalog?.currentModel &&
    models.some((option) => option.value === catalog.currentModel)
      ? catalog.currentModel
      : models[0]?.value) ?? "";
  const nextThinking =
    typeof thinkingCurrent === "string" &&
    thinking.some((option) => option.value === thinkingCurrent)
      ? thinkingCurrent
      : (thinking[0]?.value ?? "medium");
  return {
    model,
    thinking: nextThinking as CommunityAgentRuntimeThinking,
  };
}

export function runtimeSelectionForCatalog(
  catalog: CommunityAgentRuntimeCatalog | undefined,
  current: { model?: string; thinking?: string } = {},
): { model: string; thinking: CommunityAgentRuntimeThinking } {
  const defaults = runtimeCatalogDefaults(catalog);
  const models = runtimeModelOptions(catalog);
  const thinking = runtimeThinkingOptions(catalog);
  return {
    model:
      current.model && models.some((option) => option.value === current.model)
        ? current.model
        : defaults.model,
    thinking:
      current.thinking &&
      thinking.some((option) => option.value === current.thinking)
        ? (current.thinking as CommunityAgentRuntimeThinking)
        : defaults.thinking,
  };
}
