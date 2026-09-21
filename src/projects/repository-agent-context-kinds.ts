import type { RepositoryAgentContextRecord } from "./repository-agent-context-parsing.js";

type ContextRecordBase = Pick<
  RepositoryAgentContextRecord,
  "id" | "sequence" | "createdAt"
> &
  Partial<
    Pick<
      RepositoryAgentContextRecord,
      "authorPubkey" | "redacted" | "truncated" | "sourceEventId"
    >
  >;

export function parsePlanContextRecord(
  value: Record<string, unknown>,
  base: ContextRecordBase,
): RepositoryAgentContextRecord | undefined {
  if (
    !Array.isArray(value.entries) ||
    value.tool_name !== undefined ||
    value.tool_state !== undefined ||
    value.text !== undefined
  )
    return;
  return { ...base, kind: "plan", entries: value.entries };
}

export function parseUsageContextRecord(
  value: Record<string, unknown>,
  base: ContextRecordBase,
): RepositoryAgentContextRecord | undefined {
  const used = Number(value.used);
  const limit = Number(value.limit);
  if (
    !Number.isFinite(used) ||
    used < 0 ||
    value.tool_name !== undefined ||
    value.tool_state !== undefined ||
    value.text !== undefined
  )
    return;
  return {
    ...base,
    kind: "usage",
    used,
    ...(Number.isFinite(limit) && limit > 0 ? { limit } : {}),
  };
}
