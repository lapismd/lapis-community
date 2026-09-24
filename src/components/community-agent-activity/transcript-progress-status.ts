import { activityPayloadState } from "../../community/activity-frame-state.js";
import { observerRecord } from "../../community/agent-observer.js";
import {
  turnStateLabel,
  type AgentTurnState,
} from "../../community/agent-turn-state.js";
import type {
  CommunityAgentActivityItem,
  CommunityAgentTranscriptEntry,
} from "../../community/agent-contracts.js";
export function transcriptProgressStatus(
  item: CommunityAgentActivityItem,
  entry: CommunityAgentTranscriptEntry | undefined,
  current?: AgentTurnState,
) {
  const payload = observerRecord(item.frame.payload);
  const id =
    payload.lifecycleRequestId ??
    payload.requestId ??
    item.frame.turnId ??
    entry?.id;
  const state =
    current ??
    (entry?.type === "turn" && entry.state === "started"
      ? "running"
      : activityPayloadState(
          item.frame.kind,
          false,
          String(payload.state ?? ""),
          String(payload.preview ?? ""),
        ));
  return {
    id: String(id),
    text:
      !current && typeof payload.preview === "string"
        ? payload.preview
        : turnStateLabel(state),
    streaming: state === "running",
  };
}
