import { parseCanonicalTranscript } from "../protocol/agent-transcript.js";
export type RepositoryAgentContextRecord = {
  id: string;
  sequence: number;
  createdAt: number;
  kind:
    | "user_message"
    | "assistant_message"
    | "thinking"
    | "tool"
    | "transcript";
  text?: string;
  toolName?: string;
  toolState?: string;
  sourceEventId?: string;
  authorPubkey?: string;
  toolId?: string;
  input?: string;
  output?: string;
  error?: string;
  redacted?: boolean;
  truncated?: boolean;
};

export function parseAgentContextRecord(
  value: unknown,
): RepositoryAgentContextRecord | undefined {
  if (!isRecord(value)) return;
  const id = nonEmptyString(value.id);
  const sequence = nonNegativeInteger(value.sequence);
  const createdAt = nonNegativeInteger(value.created_at_ms);
  const sourceEventId = optionalString(value.source_event_id);
  const authorPubkey = optionalString(value.author_pubkey);
  if (
    authorPubkey === null ||
    (authorPubkey && !/^[a-f0-9]{64}$/u.test(authorPubkey))
  )
    return;
  const details = {
    ...(authorPubkey ? { authorPubkey } : {}),
    ...(value.redacted === true ? { redacted: true } : {}),
    ...(value.truncated === true ? { truncated: true } : {}),
  };
  if (
    !id ||
    sequence === undefined ||
    createdAt === undefined ||
    sourceEventId === null
  )
    return;
  if (
    value.kind === "user_message" ||
    value.kind === "assistant_message" ||
    value.kind === "thinking" ||
    value.kind === "transcript"
  ) {
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
      ...details,
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
      ...details,
      ...(typeof value.tool_id === "string" ? { toolId: value.tool_id } : {}),
      ...(typeof value.input === "string" ? { input: value.input } : {}),
      ...(typeof value.output === "string" ? { output: value.output } : {}),
      ...(typeof value.error === "string" ? { error: value.error } : {}),
      toolName,
      toolState,
      ...(sourceEventId ? { sourceEventId } : {}),
    };
  }
  return;
}

export { exactEventTag } from "./exact-event-tag.js";

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

/** Message identity is shared by legacy and canonical checkpoint transports. */
export function agentContextMessageRole(
  record: RepositoryAgentContextRecord,
): "user" | "assistant" | undefined {
  if (record.kind === "user_message") return "user";
  if (record.kind === "assistant_message") return "assistant";
  if (record.kind !== "transcript") return;
  const payload = parseCanonicalTranscript(record.text ?? "")?.payload;
  return payload?.kind === "message"
    ? (payload.role as "user" | "assistant")
    : undefined;
}
