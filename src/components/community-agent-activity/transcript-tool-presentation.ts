import {
  isOneLineToolAlert,
  presentToolPayload,
  toolCallTarget,
} from "@lapismd/design-core/ai/chat";
import type { CommunityAgentTranscriptEntry } from "../../community/agent-contracts.js";
import { transcriptToolStatus } from "./transcript-execution.js";
export function transcriptToolPresentation(
  item: Extract<CommunityAgentTranscriptEntry, { type: "tool" }>,
  unavailable: boolean,
) {
  const error = item.error ? presentToolPayload(item.error) : undefined;
  const target = toolCallTarget(item.input);
  return {
    status: transcriptToolStatus(item.state, unavailable),
    ...(target ? { target } : {}),
    ...(error && isOneLineToolAlert(error) ? { errorMessage: error.code } : {}),
    hasDetail: Boolean(
      item.input || item.output || (error && !isOneLineToolAlert(error)),
    ),
  };
}
