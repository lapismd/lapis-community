import type {
  CommunityAgentActivityItem,
  CommunityAgentTranscriptEntry,
} from "../../community/agent-contracts.js";
import { observerScope } from "../../community/agent-activity-context.js";

type Frame = CommunityAgentActivityItem["frame"];

/** Lifecycle IDs survive the transition from queued requests to runtime turns. */
export function transcriptRequestKey(
  frame: Frame,
  entry?: CommunityAgentTranscriptEntry,
): string | undefined {
  const payload =
    frame.payload &&
    typeof frame.payload === "object" &&
    !Array.isArray(frame.payload)
      ? (frame.payload as Record<string, unknown>)
      : {};
  const id = payload.lifecycleRequestId ?? payload.requestId ?? frame.turnId;
  const scope = observerScope(frame).scopeKey || frame.channelId || "";
  if (typeof id === "string") return `${scope}:${id}`;
  if (typeof entry?.id === "string" && entry.id.includes(":"))
    return `${scope}:${entry.id.split(":")[0]}`;
}
