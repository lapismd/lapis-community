import type { Snippet } from "svelte";
import {
  isOneLineToolAlert,
  presentToolPayload,
  toolCallTarget,
} from "@lapismd/design-core/ai/chat";
import type { CommunityAgentTranscriptEntry } from "../../community/agent-contracts.js";
import { toolCallStatus } from "./model.js";
export function transcriptToolProps(
  item: Extract<CommunityAgentTranscriptEntry, { type: "tool" }>,
  toolDetail: Snippet<[{ data?: unknown; name?: string }]>,
) {
  const error = item.error ? presentToolPayload(item.error) : undefined;
  const target = toolCallTarget(item.input);
  return {
    id: item.toolId,
    name: item.name,
    status: toolCallStatus(item.state),
    ...(target ? { target } : {}),
    ...(error && isOneLineToolAlert(error) ? { errorMessage: error.code } : {}),
    data: item,
    ...(item.input || item.output || (error && !isOneLineToolAlert(error))
      ? { detail: toolDetail }
      : {}),
  };
}
