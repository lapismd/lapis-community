import { makeTranscriptSelection } from "../protocol/transcript-comment-anchor.js";
import { parseCanonicalTranscript } from "../protocol/agent-transcript.js";
import type { RepositoryAgentContextRecord } from "./repository-agent-context.js";

/** Selectable public text follows the controller's feedback wire contract. */
export function transcriptRecordParts(
  record: RepositoryAgentContextRecord,
): Record<string, string> | undefined {
  let kind: string = record.kind;
  let body: Record<string, unknown> = record;
  if (kind === "transcript") {
    const canonical = parseCanonicalTranscript(record.text ?? "");
    if (
      !canonical ||
      typeof canonical.sanitization.redacted !== "boolean" ||
      typeof canonical.sanitization.pathsNormalized !== "boolean"
    )
      return;
    body = canonical.payload;
    kind = canonical.payload.kind;
    if (kind === "message") {
      if (body.role !== "assistant") return;
      kind = "assistant_message";
    }
    if (kind === "thinking" && body.visible !== true) return;
  }
  if (["assistant_message", "thinking"].includes(kind))
    return typeof body.text === "string" ? { text: body.text } : undefined;
  if (kind === "plan") {
    if (!Array.isArray(body.entries)) return;
    const parts: Record<string, string> = {};
    for (const [index, entry] of body.entries.entries()) {
      if (!entry || typeof entry.content !== "string") return;
      parts[`plan:${index}`] = entry.content;
    }
    return parts;
  }
  if (["tool", "tool-invocation", "tool-result"].includes(kind))
    return Object.fromEntries(
      ["input", "output", "error"].flatMap((key) =>
        body[key] == null
          ? []
          : [
              [
                key,
                typeof body[key] === "string"
                  ? body[key]
                  : JSON.stringify(body[key], null, 2),
              ],
            ],
      ),
    );
}

export function selectTranscriptPassage(
  text: string,
  start: number,
  end: number,
) {
  return makeTranscriptSelection(text, start, end);
}
export function transcriptRecordIdentity(record: RepositoryAgentContextRecord) {
  const canonical =
    record.kind === "transcript"
      ? parseCanonicalTranscript(record.text ?? "")
      : undefined;
  return {
    threadId: canonical?.threadId,
    turnId: canonical?.turnId,
    kind: canonical?.payload.kind ?? record.kind,
  };
}

export function transcriptRecordLabel(record: RepositoryAgentContextRecord) {
  const { kind } = transcriptRecordIdentity(record);
  const names: Record<string, string> = {
    message: "assistant text",
    assistant_message: "assistant text",
    thinking: "thinking",
    plan: "plan",
    tool: "tool activity",
    "tool-invocation": "tool input",
    "tool-result": "tool output",
  };
  return names[kind] ?? "activity";
}
