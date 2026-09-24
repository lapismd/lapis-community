import type { Snippet } from "svelte";
import type { CommunityAgentTranscriptEntry } from "../../community/agent-contracts.js";
import { transcriptToolPresentation } from "./transcript-tool-presentation.js";
import {
  fileEditStats,
  richTranscriptToolDetail,
  richTranscriptToolLabel,
} from "./transcript-tool-rich.js";

export function richTranscriptToolProps(
  item: Extract<CommunityAgentTranscriptEntry, { type: "tool" }>,
  toolDetail: Snippet<[{ data?: unknown; name?: string }]>,
  unavailable = false,
) {
  const { hasDetail, target, ...presentation } = transcriptToolPresentation(
    item,
    unavailable,
  );
  const rich = richTranscriptToolDetail(item);
  const stats = fileEditStats(rich);
  const label = richTranscriptToolLabel(item);
  return {
    id: item.toolId,
    name: label ?? item.name,
    ...presentation,
    ...(label && rich?.kind !== "file-edit" ? {} : target ? { target } : {}),
    ...(stats ? stats : {}),
    data: item,
    ...(hasDetail ? { detail: toolDetail } : {}),
  };
}
