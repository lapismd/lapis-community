import type {
  CommunityAgentRuntimeCatalog,
  CommunityAgentRuntimeCatalogOption,
  CommunityAgentRuntimeOption,
  CommunityAgentRuntimeThinking,
} from "./agent-runtime-contracts.js";

const THINKING_VALUES = new Set<CommunityAgentRuntimeThinking>([
  "off",
  "low",
  "medium",
  "high",
  "xhigh",
]);

const THINKING_IDS = new Set([
  "thought_level",
  "thinking",
  "effort",
  "reasoning_effort",
  "variant",
]);

const THINKING_NAMES: Record<CommunityAgentRuntimeThinking, string> = {
  off: "Off",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra high",
};

export function isRuntimeThinking(
  value: string,
): value is CommunityAgentRuntimeThinking {
  return THINKING_VALUES.has(value as CommunityAgentRuntimeThinking);
}

export function thinkingOptionName(
  value: CommunityAgentRuntimeThinking,
): string {
  return THINKING_NAMES[value];
}

export function isThinkingConfigOption(
  option: Pick<CommunityAgentRuntimeCatalogOption, "id" | "category">,
): boolean {
  return (
    option.category === "thought" ||
    option.category === "thinking" ||
    THINKING_IDS.has(option.id)
  );
}

export function advertisedThinkingOptions(
  options: readonly CommunityAgentRuntimeOption[] | undefined,
): readonly CommunityAgentRuntimeOption[] {
  return (
    options?.filter((candidate) => isRuntimeThinking(candidate.value)) ?? []
  );
}

export function thinkingValuesAsOptions(
  values: readonly string[] | undefined,
): readonly CommunityAgentRuntimeOption[] {
  return (values ?? []).flatMap((value) =>
    isRuntimeThinking(value)
      ? [{ value, name: thinkingOptionName(value) }]
      : [],
  );
}

export function runtimeThinkingOptions(
  catalog?: CommunityAgentRuntimeCatalog,
  model?: string,
): readonly CommunityAgentRuntimeOption[] {
  const selected = model || catalog?.currentModel;
  const entry = selected
    ? catalog?.entries?.find((item) => item.id === selected)
    : undefined;
  const fromModel = advertisedThinkingOptions(
    entry
      ? (entry.configOptions?.find(isThinkingConfigOption)?.options ??
          thinkingValuesAsOptions(entry.thinkingValues))
      : undefined,
  );
  if (fromModel.length > 0) return fromModel;
  return advertisedThinkingOptions(
    catalog?.configOptions.find(isThinkingConfigOption)?.options,
  );
}

export function runtimeThinkingCurrent(
  catalog?: CommunityAgentRuntimeCatalog,
  model?: string,
): string | undefined {
  const selected = model || catalog?.currentModel;
  const entry = selected
    ? catalog?.entries?.find((item) => item.id === selected)
    : undefined;
  const current =
    entry?.configOptions?.find(isThinkingConfigOption)?.currentValue ??
    catalog?.configOptions.find(isThinkingConfigOption)?.currentValue;
  return typeof current === "string" ? current : undefined;
}
