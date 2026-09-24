import {
  transcriptExecutionState,
  type TranscriptExecution,
} from "./transcript-execution.js";
import { transcriptProgressStatus } from "./transcript-progress-status.js";
import { observerRecord as record } from "../../community/agent-observer.js";
import {
  turnStateLabel,
  turnIsTerminal,
} from "../../community/agent-turn-state.js";
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
  execution?: Partial<TranscriptExecution>,
): { id: string; text: string; streaming: boolean }[] {
  const pending = new Map<
    string,
    { id: string; text: string; streaming: boolean }
  >();
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
    const current = transcriptExecutionState(item, execution);
    if (current && turnIsTerminal(current)) {
      pending.delete(key);
      ended.add(key);
      continue;
    }
    if (closeTranscriptProgress(item, key, ended, pending, activity, nowMs)) {
      const status = pending.get(key);
      if (status && current)
        pending.set(key, {
          ...status,
          text: turnStateLabel(current),
          streaming: current === "running",
        });
      continue;
    }
    if (
      item.frame.kind === "request_status" ||
      (entry?.type === "turn" && entry.state === "started")
    ) {
      pending.set(key, transcriptProgressStatus(item, entry, current));
    }
  }
  return [...pending.values()];
}
