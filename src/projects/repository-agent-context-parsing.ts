import type { NostrEvent } from "../protocol/index.js";

export type RepositoryAgentContextRecord = {
  id: string;
  sequence: number;
  createdAt: number;
  kind: "user_message" | "assistant_message" | "tool";
  text?: string;
  toolName?: string;
  toolState?: string;
  sourceEventId?: string;
};

export function parseAgentContextRecord(
  value: unknown,
): RepositoryAgentContextRecord | undefined {
  if (!isRecord(value)) return;
  const id = nonEmptyString(value.id);
  const sequence = nonNegativeInteger(value.sequence);
  const createdAt = nonNegativeInteger(value.created_at_ms);
  const sourceEventId = optionalString(value.source_event_id);
  if (
    !id ||
    sequence === undefined ||
    createdAt === undefined ||
    sourceEventId === null
  )
    return;
  if (value.kind === "user_message" || value.kind === "assistant_message") {
    const text = nonEmptyString(value.text);
    if (
      !text ||
      value.tool_name !== undefined ||
      value.tool_state !== undefined
    )
      return;
    return {
      id,
      sequence,
      createdAt,
      kind: value.kind,
      text,
      ...(sourceEventId ? { sourceEventId } : {}),
    };
  }
  if (value.kind === "tool") {
    const toolName = nonEmptyString(value.tool_name);
    const toolState = nonEmptyString(value.tool_state);
    if (!toolName || !toolState || value.text !== undefined) return;
    return {
      id,
      sequence,
      createdAt,
      kind: "tool",
      toolName,
      toolState,
      ...(sourceEventId ? { sourceEventId } : {}),
    };
  }
  return;
}

export function exactEventTag(
  event: NostrEvent,
  name: string,
): string | undefined {
  const tags = event.tags.filter((tag) => tag[0] === name);
  return tags.length === 1 && tags[0]?.length === 2 && tags[0][1]
    ? tags[0][1]
    : undefined;
}

export function parseJsonRecord(content: string): Record<string, unknown> {
  try {
    const value = JSON.parse(content) as unknown;
    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function nonNegativeInteger(value: unknown): number | undefined {
  return Number.isSafeInteger(value) && Number(value) >= 0
    ? Number(value)
    : undefined;
}

export function nonEmptyStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string => typeof item === "string" && item.length > 0,
      )
    : [];
}

export function arrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : -1;
}

export function isCheckpointOutcome(
  value: unknown,
): value is "completed" | "failed" | "cancelled" {
  return value === "completed" || value === "failed" || value === "cancelled";
}

function optionalString(value: unknown): string | undefined | null {
  return value === undefined ? undefined : (nonEmptyString(value) ?? null);
}
