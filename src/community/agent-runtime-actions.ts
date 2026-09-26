import type {
  CommunityAgentRuntimeState,
  CommunityAgentMemoryState,
} from "./agent-contracts.js";
export interface RuntimeAgentActions {
  refreshRuntime?(pubkey: string): Promise<void>;
  loadRuntime(pubkey: string): Promise<CommunityAgentRuntimeState>;
  saveRuntime(
    pubkey: string,
    defaults: import("./agent-runtime-set.js").CommunityAgentRuntimeSettings,
  ): Promise<CommunityAgentRuntimeState>;
  loadMemories(
    pubkey: string,
    channelId: string,
    filter?: {
      status?: "approved" | "review" | "rejected" | "retracted";
      query?: string;
    },
  ): Promise<CommunityAgentMemoryState>;
  actOnMemory(
    pubkey: string,
    input: {
      channelId: string;
      action: "approve" | "reject" | "retract";
      candidateId?: string;
      memoryId?: string;
    },
  ): Promise<CommunityAgentMemoryState>;
}
