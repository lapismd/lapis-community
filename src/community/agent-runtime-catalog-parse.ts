import type {
  CommunityAgentRuntimeAgent,
  CommunityAgentRuntimeCatalog,
  CommunityAgentRuntimeCatalogEntry,
  CommunityAgentRuntimeThinking,
} from "./agent-runtime-contracts.js";
import { observerRecord, observerText } from "./agent-observer.js";
import { isRuntimeThinking } from "./agent-runtime-thinking.js";

function parseCatalogOptions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
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
                        description: observerText(candidate.description, 1_024),
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
  });
}

function parseCatalogEntries(
  value: unknown,
): readonly CommunityAgentRuntimeCatalogEntry[] | undefined {
  if (!Array.isArray(value)) return;
  const entries = value.flatMap((entry) => {
    const item = observerRecord(entry);
    const id = observerText(item.id, 256);
    if (!id) return [];
    const thinkingValues = Array.isArray(item.thinkingValues)
      ? item.thinkingValues.filter(
          (candidate): candidate is CommunityAgentRuntimeThinking =>
            typeof candidate === "string" && isRuntimeThinking(candidate),
        )
      : undefined;
    const configOptions = parseCatalogOptions(item.configOptions);
    return [
      {
        id,
        ...(observerText(item.label, 256)
          ? { label: observerText(item.label, 256) }
          : {}),
        ...(thinkingValues?.length ? { thinkingValues } : {}),
        ...(configOptions.length ? { configOptions } : {}),
      },
    ];
  });
  return entries.length ? entries : undefined;
}

function parseModelId(value: unknown): string {
  if (typeof value === "string") return observerText(value, 256);
  const item = observerRecord(value);
  return observerText(item.id, 256) || observerText(item.value, 256);
}

export function parseRuntimeCatalog(
  value: unknown,
): CommunityAgentRuntimeCatalog | undefined {
  const catalog = observerRecord(value);
  const agent = observerText(catalog.agent, 256);
  if (!agent) return;
  const entries = parseCatalogEntries(catalog.entries);
  return {
    agent,
    ...(observerText(catalog.currentModel, 256)
      ? { currentModel: observerText(catalog.currentModel, 256) }
      : {}),
    models: Array.isArray(catalog.models)
      ? catalog.models.map(parseModelId).filter(Boolean)
      : [],
    ...(entries ? { entries } : {}),
    configOptions: parseCatalogOptions(catalog.configOptions),
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
