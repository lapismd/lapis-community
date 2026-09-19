import type {
  CommunityAgentActivityContext,
  CommunityAgentActivityItem,
  CommunityAgentTranscriptEntry,
} from "../../community/agent-contracts.js";
import {
  activityMatches,
  observerScope,
} from "../../community/agent-activity-context.js";

type Frame = CommunityAgentActivityItem["frame"];

/** Lifecycle IDs survive the transition from queued requests to runtime turns. */
export function transcriptRequestKey(
  frame: Frame,
  entry?: CommunityAgentTranscriptEntry,
): string | undefined {
  const payload = record(frame.payload);
  const id = payload.lifecycleRequestId ?? payload.requestId ?? frame.turnId;
  const scope = observerScope(frame).scopeKey || frame.channelId || "";
  if (typeof id === "string") return `${scope}:${id}`;
  // Early v2 records used only the controller run ID in their entry IDs.
  if (typeof entry?.id === "string" && entry.id.includes(":"))
    return `${scope}:${entry.id.split(":")[0]}`;
}

/** Keep progress visible for the whole request, including gaps after output. */
export function pendingTranscriptStatuses(
  activity: readonly CommunityAgentActivityItem[],
  agentPubkey: string,
  context?: CommunityAgentActivityContext,
): { id: string; text: string }[] {
  const pending = new Map<string, { id: string; text: string }>();
  const ended = new Set<string>();
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
    const entry = payload.entry as CommunityAgentTranscriptEntry | undefined;
    const key = transcriptRequestKey(item.frame, entry);
    if (!key) continue;
    const terminal =
      ["completed", "failed", "cancelled", "interrupted"].includes(
        String(payload.state),
      ) ||
      ["turn_completed", "turn_failed", "turn_cancelled"].includes(
        item.frame.kind,
      ) ||
      (entry?.type === "turn" &&
        ["completed", "failed", "cancelled"].includes(entry.state));
    if (terminal) {
      ended.add(key);
      pending.delete(key);
      continue;
    }
    if (ended.has(key)) continue;
    if (
      item.frame.kind === "request_status" ||
      (entry?.type === "turn" && entry.state === "started")
    ) {
      const id =
        payload.lifecycleRequestId ??
        payload.requestId ??
        item.frame.turnId ??
        entry?.id;
      pending.set(key, {
        id: String(id),
        text: typeof payload.preview === "string" ? payload.preview : "Working",
      });
    }
  }
  return [...pending.values()];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
