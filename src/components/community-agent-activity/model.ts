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

/** Keep cold-start progress visible before the runtime emits transcript output. */
export function pendingTranscriptStatuses(
  activity: readonly CommunityAgentActivityItem[],
  agentPubkey: string,
  context?: CommunityAgentActivityContext,
): { id: string; text: string }[] {
  const pending = new Map<string, string>();
  const hasOutput = new Set<string>();
  for (const item of activity.toSorted(
    (a, b) => a.createdAt - b.createdAt || a.frame.seq - b.frame.seq,
  )) {
    if (
      item.agentPubkey !== agentPubkey ||
      item.frame.version !== 2 ||
      !activityMatches(context, { agentPubkey, ...observerScope(item.frame) })
    )
      continue;
    const payload = record(item.frame.payload);
    const id =
      payload.lifecycleRequestId ?? payload.requestId ?? item.frame.turnId;
    if (typeof id !== "string") continue;
    const entry = record(payload.entry);
    if (
      entry.type === "tool" ||
      entry.type === "thinking" ||
      (entry.type === "message" && entry.role === "assistant") ||
      ["completed", "failed", "cancelled", "interrupted"].includes(
        String(payload.state),
      ) ||
      ["turn_completed", "turn_failed", "turn_cancelled"].includes(
        item.frame.kind,
      )
    ) {
      hasOutput.add(id);
      pending.delete(id);
    } else if (
      item.frame.kind === "request_status" &&
      typeof payload.preview === "string" &&
      !hasOutput.has(id)
    ) {
      pending.set(id, payload.preview);
    }
  }
  return [...pending].map(([id, text]) => ({ id, text }));
}

export function agentTranscriptTimeline(
  activity: readonly CommunityAgentActivityItem[],
  agentPubkey: string | undefined,
  context: CommunityAgentActivityContext | undefined,
): CommunityAgentTranscriptTimeline[] {
  if (!agentPubkey) return [];
  const entries = activity
    .filter(
      (item) =>
        item.agentPubkey === agentPubkey &&
        item.frame.version === 2 &&
        activityMatches(context, {
          agentPubkey: item.agentPubkey,
          ...observerScope(item.frame),
        }),
    )
    .toSorted(
      (left, right) =>
        left.createdAt - right.createdAt ||
        left.frame.seq - right.frame.seq ||
        left.id.localeCompare(right.id),
    )
    .flatMap(({ frame }) => {
      const payload = record(frame.payload);
      const entry = transcriptEntry(payload.entry);
      return entry ? [{ entry, frame }] : [];
    });

  const timeline: CommunityAgentTranscriptTimeline[] = [];
  const locations = new Map<string, { group: number; item?: number }>();
  for (const { entry, frame } of entries) {
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
        current.items[location.item] = {
          ...current.items[location.item],
          ...entry,
        };
      } else if (
        current?.kind === "permission" &&
        entry.type === "permission"
      ) {
        current.item = { ...current.item, ...entry };
      } else if (current?.kind === "turn" && entry.type === "turn") {
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

    if (entry.type === "turn" && entry.state !== "started") {
      const prefix = entry.id.endsWith(":turn") ? entry.id.slice(0, -5) : "";
      const thinking = prefix ? locations.get(`${prefix}:thinking`) : undefined;
      const thought = thinking ? timeline[thinking.group] : undefined;
      if (thought?.kind === "thinking") thought.item.state = "done";
    }

    // The signed event sequence remains the ordering authority when a producer
    // omits the optional entry sequence.
    if (entry.sequence === undefined) entry.sequence = frame.seq;
  }
  return timeline;
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
