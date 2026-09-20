import { canonicalActivity } from "../../community/canonical-transcript-activity.js";
import type {
  CommunityAgentActivityContext,
  CommunityAgentActivityItem,
  CommunityAgentTranscriptEntry,
} from "../../community/agent-contracts.js";
import {
  activityMatches,
  observerScope,
} from "../../community/agent-activity-context.js";

export type CommunityAgentTranscriptTimeline =
  | {
      kind: "context";
      item: Extract<CommunityAgentTranscriptEntry, { type: "context" }>;
    }
  | {
      kind: "message";
      item: Extract<CommunityAgentTranscriptEntry, { type: "message" }>;
    }
  | {
      kind: "thinking";
      item: Extract<CommunityAgentTranscriptEntry, { type: "thinking" }>;
    }
  | {
      kind: "tools";
      id: string;
      items: Extract<CommunityAgentTranscriptEntry, { type: "tool" }>[];
    }
  | {
      kind: "permission";
      item: Extract<CommunityAgentTranscriptEntry, { type: "permission" }>;
    }
  | {
      kind: "turn";
      item: Extract<CommunityAgentTranscriptEntry, { type: "turn" }>;
    };

export { pendingTranscriptStatuses } from "./transcript-progress.js";
import { transcriptRequestKey } from "./transcript-progress.js";

export function agentTranscriptTimeline(
  activity: readonly CommunityAgentActivityItem[],
  agentPubkey: string | undefined,
  context: CommunityAgentActivityContext | undefined,
): CommunityAgentTranscriptTimeline[] {
  if (!agentPubkey) return [];
  const events = new Set<string>();
  const entries = canonicalActivity(activity)
    .filter(
      (item) =>
        item.agentPubkey === agentPubkey &&
        item.frame.version === 2 &&
        activityMatches(context, {
          agentPubkey: item.agentPubkey,
          ...observerScope(item.frame),
        }),
    )
    .filter((item) => {
      if (events.has(item.id)) return false;
      events.add(item.id);
      return true;
    })
    .toSorted(
      (left, right) =>
        left.createdAt - right.createdAt ||
        left.frame.seq - right.frame.seq ||
        left.id.localeCompare(right.id),
    )
    .flatMap(({ frame }) => {
      const payload = record(frame.payload);
      const entry =
        transcriptEntry(payload.entry) ??
        (frame.kind === "capture_gap"
          ? transcriptEntry({
              id: `gap:${frame.sessionId}:${frame.seq}`,
              type: "context",
              label: "Capture gap",
              text: String(payload.reason ?? "Capture unavailable"),
              createdAt: frame.timestamp,
            })
          : undefined);
      return entry ? [{ entry, frame }] : [];
    });

  const timeline: CommunityAgentTranscriptTimeline[] = [];
  const turns = new Map<string, string>();
  const ended = new Set<string>();
  const locations = new Map<string, { group: number; item?: number }>();
  for (const { entry, frame } of entries) {
    const turn = transcriptRequestKey(frame, entry);
    if (turn) turns.set(entry.id, turn);
    if (entry.sequence === undefined) entry.sequence = frame.seq;
    if (entry.type === "tool") entry.state = resolvedToolState(entry);
    if (
      turn &&
      entry.type !== "thinking" &&
      (entry.type === "tool" ||
        (entry.type === "message" && entry.role === "assistant") ||
        (entry.type === "turn" && entry.state !== "started"))
    ) {
      for (const current of timeline) {
        if (current.kind === "thinking" && turns.get(current.item.id) === turn)
          current.item.state = "done";
      }
    }
    if (turn && entry.type === "turn" && entry.state !== "started")
      ended.add(turn);
    const location = locations.get(entry.id);
    if (location) {
      const current = timeline[location.group];
      if (current?.kind === "message" && entry.type === "message") {
        current.item = {
          ...current.item,
          ...entry,
          text: `${current.item.text}${entry.text}`,
        };
      } else if (current?.kind === "thinking" && entry.type === "thinking") {
        current.item = {
          ...current.item,
          ...entry,
          text: `${current.item.text}${entry.text}`,
        };
      } else if (
        current?.kind === "tools" &&
        entry.type === "tool" &&
        location.item !== undefined
      ) {
        const previous = current.items[location.item]!;
        const merged = {
          ...previous,
          ...entry,
          name: entry.name === "Tool result" ? previous.name : entry.name,
        };
        merged.state =
          previous.state !== "running" && entry.state === "running"
            ? previous.state
            : resolvedToolState(merged);
        current.items[location.item] = merged;
      } else if (
        current?.kind === "permission" &&
        entry.type === "permission"
      ) {
        current.item = { ...current.item, ...entry };
      } else if (current?.kind === "turn" && entry.type === "turn") {
        if (current.item.state === "started" || entry.state !== "started")
          current.item = { ...current.item, ...entry };
      }
      continue;
    }

    if (entry.type === "tool") {
      const previous = timeline.at(-1);
      if (previous?.kind === "tools") {
        previous.items.push(entry);
        locations.set(entry.id, {
          group: timeline.length - 1,
          item: previous.items.length - 1,
        });
      } else {
        timeline.push({
          kind: "tools",
          id: `tools:${entry.id}`,
          items: [entry],
        });
        locations.set(entry.id, { group: timeline.length - 1, item: 0 });
      }
      continue;
    }
    timeline.push({
      kind: entry.type,
      item: entry,
    } as CommunityAgentTranscriptTimeline);
    locations.set(entry.id, { group: timeline.length - 1 });
  }
  for (const current of timeline) {
    if (
      current.kind === "thinking" &&
      ended.has(turns.get(current.item.id) ?? "")
    )
      current.item.state = "done";
    if (current.kind === "tools")
      for (const tool of current.items) {
        if (tool.state === "running" && ended.has(turns.get(tool.id) ?? "")) {
          tool.state = "error";
          tool.error = "The turn ended before a tool result was received.";
        }
      }
  }
  return timeline;
}

type TranscriptTool = Extract<CommunityAgentTranscriptEntry, { type: "tool" }>;

function resolvedToolState(tool: TranscriptTool): TranscriptTool["state"] {
  if (tool.state === "error" || tool.error !== undefined) return "error";
  return tool.state === "completed" || tool.output !== undefined
    ? "completed"
    : "running";
}

export function toolCallStatus(
  state: Extract<CommunityAgentTranscriptEntry, { type: "tool" }>["state"],
): "complete" | "error" | "running" {
  return state === "completed"
    ? "complete"
    : state === "error"
      ? "error"
      : "running";
}

function transcriptEntry(
  value: unknown,
): CommunityAgentTranscriptEntry | undefined {
  const entry = record(value);
  if (
    typeof entry.id !== "string" ||
    !entry.id ||
    typeof entry.type !== "string" ||
    typeof entry.createdAt !== "string" ||
    !Number.isFinite(Date.parse(entry.createdAt))
  )
    return;
  if (entry.type === "message") {
    if (
      (entry.role !== "user" && entry.role !== "assistant") ||
      typeof entry.text !== "string" ||
      typeof entry.authorPubkey !== "string"
    )
      return;
  } else if (entry.type === "thinking") {
    if (
      typeof entry.text !== "string" ||
      (entry.state !== "streaming" && entry.state !== "done")
    )
      return;
  } else if (entry.type === "tool") {
    if (
      typeof entry.toolId !== "string" ||
      typeof entry.name !== "string" ||
      !["running", "completed", "error"].includes(String(entry.state)) ||
      !optionalStrings(entry, ["input", "output", "error"])
    )
      return;
  } else if (entry.type === "permission") {
    if (
      typeof entry.requestId !== "string" ||
      typeof entry.tool !== "string" ||
      !Array.isArray(entry.options) ||
      !entry.options.every((option) => typeof option === "string") ||
      (entry.state !== "pending" && entry.state !== "resolved") ||
      !optionalStrings(entry, ["input", "decision"])
    )
      return;
  } else if (entry.type === "context") {
    if (typeof entry.label !== "string" || typeof entry.text !== "string")
      return;
  } else if (entry.type === "turn") {
    if (
      !["started", "completed", "failed", "cancelled"].includes(
        String(entry.state),
      ) ||
      !optionalStrings(entry, ["message"])
    )
      return;
  } else return;
  return {
    ...entry,
    ...(Array.isArray(entry.options) ? { options: [...entry.options] } : {}),
  } as unknown as CommunityAgentTranscriptEntry;
}

function optionalStrings(
  value: Record<string, unknown>,
  keys: string[],
): boolean {
  return keys.every(
    (key) => value[key] === undefined || typeof value[key] === "string",
  );
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
