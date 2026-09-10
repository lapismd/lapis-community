import type { CommunityAgentActivityItem } from "../../community/agent-contracts.js";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function label(value: unknown): string {
  return typeof value === "string" ? value.slice(0, 500) : "";
}
function text(value: unknown, depth = 0): string {
  if (depth > 5) return "";
  if (typeof value === "string") return value.slice(0, 12_000);
  if (Array.isArray(value))
    return value
      .slice(0, 30)
      .map((item) => text(item, depth + 1))
      .filter(Boolean)
      .join("\n");
  const object = record(value);
  return ["text", "message", "content", "output", "error"]
    .map((key) =>
      object[key] === undefined ? "" : text(object[key], depth + 1),
    )
    .filter(Boolean)
    .join("\n")
    .slice(0, 12_000);
}

export function presentAgentActivity(item: CommunityAgentActivityItem): {
  category: "Message" | "Tool" | "Plan" | "Status" | "Error" | "Event";
  title: string;
  body: string;
} {
  const { frame } = item;
  const payload = record(frame.payload);
  const update = record(record(payload.params).update);
  const updateKind = label(update.sessionUpdate);
  if (
    updateKind === "agent_message_chunk" ||
    updateKind === "user_message_chunk" ||
    updateKind === "agent_thought_chunk"
  )
    return {
      category: "Message",
      title:
        updateKind === "user_message_chunk"
          ? "Prompt"
          : updateKind === "agent_thought_chunk"
            ? "Agent thought"
            : "Agent message",
      body: text(update.content),
    };
  if (updateKind === "tool_call" || updateKind === "tool_call_update")
    return {
      category: "Tool",
      title: label(update.title) || label(update.kind) || "Tool activity",
      body: [
        label(update.status),
        text(update.content),
        text(update.rawOutput),
        label(record(update.rawInput).command),
      ]
        .filter(Boolean)
        .join("\n"),
    };
  if (updateKind === "plan")
    return {
      category: "Plan",
      title: "Agent plan",
      body: Array.isArray(update.entries)
        ? update.entries
            .slice(0, 50)
            .map((entry) => {
              const row = record(entry);
              return `${label(row.status)}: ${label(row.content)}`;
            })
            .join("\n")
        : text(update),
    };
  if (
    frame.kind.includes("error") ||
    frame.kind === "turn_failed" ||
    payload.error
  )
    return {
      category: "Error",
      title: "Agent error",
      body: text(payload) || "The agent reported an error.",
    };
  const lifecycle: Record<string, string> = {
    turn_started: "Turn started",
    turn_completed: "Turn completed",
    turn_finished: "Turn finished",
    turn_cancelled: "Turn cancelled",
    session_resolved: "Session ready",
    agent_stopped: "Agent stopped",
  };
  if (lifecycle[frame.kind])
    return {
      category: "Status",
      title: lifecycle[frame.kind]!,
      body: text(payload),
    };
  return {
    category: "Event",
    title: label(payload.title) || frame.kind.replaceAll("_", " "),
    body: text(payload) || safeJson(frame.payload),
  };
}

function safeJson(value: unknown): string {
  try {
    return (JSON.stringify(value, null, 2) ?? "").slice(0, 12_000);
  } catch {
    return "Unrecognized activity payload";
  }
}
