import type {
  CommunityAgentActivityContext,
  CommunityAgentActivityItem,
  CommunityAgentTranscriptEntry,
} from "../../community/agent-contracts.js";
import {
  activityMatches,
  observerScope,
} from "../../community/agent-activity-context.js";
import { closeTranscriptProgress } from "./transcript-permission-wait.js";
import { transcriptRequestKey } from "./transcript-request-key.js";

export { transcriptRequestKey } from "./transcript-request-key.js";
export { closeTranscriptProgress } from "./transcript-permission-wait.js";

/** Keep progress visible for the whole request, including gaps after output. */
export function pendingTranscriptStatuses(
  activity: readonly CommunityAgentActivityItem[],
  agentPubkey: string,
  context?: CommunityAgentActivityContext,
  nowMs = Date.now(),
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
    if (closeTranscriptProgress(item, key, ended, pending, activity, nowMs))
      continue;
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
