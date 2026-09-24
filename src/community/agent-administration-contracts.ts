import type {
  CommunityAgentControl,
  CommunityAgentRuntimeState,
  CommunityAgentMemoryState,
  CommunityAgentProcessingState,
} from "./agent-contracts.js";

export interface AgentAdministrationRequest {
  agentPubkey: string;
  responseKind: "runtime_state" | "memory_state" | "processing_state";
  resolve(
    value:
      | CommunityAgentRuntimeState
      | CommunityAgentMemoryState
      | CommunityAgentProcessingState,
  ): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout>;
}

export type AgentAdministrationControl =
  | Omit<
      Extract<CommunityAgentControl, { command: "processing_get" }>,
      "requestId"
    >
  | Omit<
      Extract<CommunityAgentControl, { command: "processing_set" }>,
      "requestId"
    >
  | Omit<
      Extract<CommunityAgentControl, { command: "runtime_get" }>,
      "requestId"
    >
  | Omit<
      Extract<CommunityAgentControl, { command: "runtime_set" }>,
      "requestId"
    >
  | Omit<
      Extract<CommunityAgentControl, { command: "memory_list" }>,
      "requestId"
    >
  | Omit<
      Extract<CommunityAgentControl, { command: "memory_action" }>,
      "requestId"
    >;
