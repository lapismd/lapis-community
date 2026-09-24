import type { Snippet } from "svelte";
import type { CommunityAgentTranscriptEntry } from "../../community/agent-contracts.js";
import { transcriptToolPresentation } from "./transcript-tool-presentation.js";
export function transcriptToolProps(
  item: Extract<CommunityAgentTranscriptEntry, { type: "tool" }>,
  toolDetail: Snippet<[{ data?: unknown; name?: string }]>,
  unavailable = false,
) {
  const { hasDetail, ...presentation } = transcriptToolPresentation(
    item,
    unavailable,
  );
  return {
    id: item.toolId,
    name: item.name,
    ...presentation,
    data: item,
    ...(hasDetail ? { detail: toolDetail } : {}),
  };
}
