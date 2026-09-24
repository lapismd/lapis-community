import type { Snippet } from "svelte";
import type { TranscriptExecution } from "./transcript-execution.js";
import type {
  CommunityAgentActivityContext,
  CommunityAgentActivityItem,
  CommunityAgentIdentity,
  CommunityAgentTranscriptEntry,
} from "../../community/agent-contracts.js";
import type { CommunityMemberModel } from "../community-workspace/model.js";
export interface CommunityAgentTranscriptProps {
  execution?: Partial<TranscriptExecution>;
  header?: Snippet;
  messageContent?: Snippet<
    [Extract<CommunityAgentTranscriptEntry, { type: "message" }>]
  >;
  working?: boolean;
  activity: readonly CommunityAgentActivityItem[];
  agent: Pick<CommunityAgentIdentity, "pubkey" | "name" | "avatarUrl">;
  context?: CommunityAgentActivityContext;
  members?: readonly CommunityMemberModel[];
  onOpenRequest?: (item: CommunityAgentActivityItem) => void;
  onLoadOlder?: () => void | Promise<void>;
  hasOlder?: boolean;
  loading?: boolean;
}
