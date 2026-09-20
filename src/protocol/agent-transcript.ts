/** A transport reader, not a browser secret scanner. Trust remains with the signed author. */
export interface CanonicalTranscript {
  schema: "lapis.transcript/1";
  id: string;
  sessionId: string;
  threadId: string;
  turnId: string;
  attemptId: string;
  sequence: number;
  at: number;
  source: Record<string, unknown>;
  payload: Record<string, unknown> & { kind: string };
  coverage: { mode: string; observations: string; gaps: string[] };
  sanitization: { policy: string; redacted: boolean; pathsNormalized: boolean };
}
const kinds = new Set([
  "message",
  "thinking",
  "plan",
  "tool-invocation",
  "tool-result",
  "file",
  "patch",
  "command",
  "permission",
  "input",
  "lifecycle",
  "error",
  "cancellation",
  "checkpoint",
  "compaction",
  "subagent",
  "extension",
  "omission",
]);
export function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function parseCanonicalTranscript(
  text: string,
): CanonicalTranscript | undefined {
  if (new TextEncoder().encode(text).byteLength > 4 * 1024 * 1024) return;
  try {
    const value = object(JSON.parse(text)),
      payload = object(value.payload);
    const bounded = (v: unknown, depth = 0): boolean =>
      depth <= 32 &&
      (!v ||
        typeof v !== "object" ||
        Object.values(v).every((item) => bounded(item, depth + 1)));
    if (!bounded(value)) return;
    const coverage = object(value.coverage),
      sanitization = object(value.sanitization);
    if (
      value.schema !== "lapis.transcript/1" ||
      ![
        value.id,
        value.sessionId,
        value.threadId,
        value.turnId,
        value.attemptId,
        object(value.source).provider,
      ].every(
        (v) => typeof v === "string" && v.length > 0 && v.length <= 1024,
      ) ||
      !Number.isSafeInteger(value.sequence) ||
      Number(value.sequence) < 1 ||
      !Number.isFinite(value.at) ||
      Math.abs(Number(value.at)) > 8.64e15 ||
      !kinds.has(String(payload.kind)) ||
      typeof sanitization.policy !== "string" ||
      ![
        "managed-observable",
        "external-acp",
        "cooperative-mark",
        "jj-only",
        "legacy",
      ].includes(String(coverage.mode)) ||
      !["complete-exposed", "normalized", "partial"].includes(
        String(coverage.observations),
      ) ||
      !Array.isArray(coverage.gaps) ||
      !coverage.gaps.every((v) => typeof v === "string")
    )
      return;
    if (
      ["message", "thinking"].includes(String(payload.kind)) &&
      typeof payload.text !== "string"
    )
      return;
    if (
      payload.kind === "message" &&
      !["assistant", "user"].includes(String(payload.role))
    )
      return;
    if (payload.kind === "thinking" && payload.visible !== true) return;
    if (
      ["tool-invocation", "tool-result"].includes(String(payload.kind)) &&
      typeof payload.invocationId !== "string"
    )
      return;
    return value as unknown as CanonicalTranscript;
  } catch {
    return;
  }
}
