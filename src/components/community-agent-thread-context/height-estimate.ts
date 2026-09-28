import type {
  CommunityAgentActivityContext,
  CommunityAgentActivityItem,
} from "../../community/agent-contracts.js";
import { agentTranscriptTimeline } from "../community-agent-activity/model.js";
import type { CommunityAgentTranscriptTimeline } from "../community-agent-activity/transcript-timeline.js";
import type { AgentThreadContextProjection } from "./context-projection.js";

const transcriptPadding = 16;
const transcriptGap = 8;

export function estimateAgentThreadContextHeight(
  projection: AgentThreadContextProjection,
): number {
  const blocks = [
    ...projection.owners.map((owner) =>
      estimateAgentTranscriptHeight(
        owner.activity,
        owner.agentPubkey,
        projection.context,
      ),
    ),
    ...projection.segments.flatMap((segment) => [
      segment.activity.length
        ? estimateAgentTranscriptHeight(
            segment.activity,
            segment.agent,
            undefined,
          )
        : 0,
      segment.commitIds.length ? 36 : 0,
    ]),
    ...projection.comments.map(() => 104),
  ].filter((height) => height > 0);

  return blocks.length
    ? blocks.reduce((total, height) => total + height, 8)
    : 0;
}

export function estimateAgentTranscriptHeight(
  activity: readonly CommunityAgentActivityItem[],
  agentPubkey: string,
  context?: CommunityAgentActivityContext,
): number {
  const rows = agentTranscriptTimeline(activity, agentPubkey, context)
    .map(estimateTranscriptRowHeight)
    .filter((height) => height > 0);
  if (!rows.length) return 0;
  return (
    transcriptPadding +
    rows.reduce((total, height) => total + height, 0) +
    transcriptGap * (rows.length - 1)
  );
}

function estimateTranscriptRowHeight(
  entry: CommunityAgentTranscriptTimeline,
): number {
  if (entry.kind === "thinking") return 36;
  if (entry.kind === "tools") return 32;
  if (entry.kind === "permission")
    return entry.item.state === "resolved" ? 24 : 0;
  if (entry.kind === "usage") return 36;
  if (entry.kind === "context") return 28;
  if (entry.kind === "plan") {
    const steps = entry.item.entries.reduce(
      (height, step) => height + Math.max(24, textLines(step.content, 56) * 20),
      0,
    );
    return 28 + steps + Math.max(0, entry.item.entries.length - 1) * 8;
  }
  if (entry.kind === "message") return 58 + textLines(entry.item.text, 56) * 20;
  if (entry.item.state === "cancelled") return 36;
  if (entry.item.state === "failed")
    return (
      58 + textLines(entry.item.message ?? "The agent turn failed.", 56) * 20
    );
  return 0;
}

function textLines(value: string, width: number): number {
  const hardLines = Math.max(1, value.split("\n").length);
  return Math.max(hardLines, Math.ceil(value.length / width));
}
