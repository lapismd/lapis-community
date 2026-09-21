import type { CommunityAgentTranscriptEntry } from "../../community/agent-contracts.js";

export type CommunityAgentTranscriptTimeline =
  | {
      kind: "context";
      item: Extract<CommunityAgentTranscriptEntry, { type: "context" }>;
    }
  | {
      kind: "message";
      item: Extract<CommunityAgentTranscriptEntry, { type: "message" }>;
    }
  | {
      kind: "thinking";
      item: Extract<CommunityAgentTranscriptEntry, { type: "thinking" }>;
    }
  | {
      kind: "tools";
      id: string;
      items: Extract<CommunityAgentTranscriptEntry, { type: "tool" }>[];
    }
  | {
      kind: "permission";
      item: Extract<CommunityAgentTranscriptEntry, { type: "permission" }>;
    }
  | {
      kind: "usage";
      item: Extract<CommunityAgentTranscriptEntry, { type: "usage" }>;
    }
  | {
      kind: "turn";
      item: Extract<CommunityAgentTranscriptEntry, { type: "turn" }>;
    }
  | {
      kind: "plan";
      item: Extract<CommunityAgentTranscriptEntry, { type: "plan" }>;
    };
