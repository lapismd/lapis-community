export type {
  CommunityAgentRuntimeCatalog,
  CommunityAgentRuntimeCatalogEntry,
  CommunityAgentRuntimeCatalogOption,
  CommunityAgentRuntimeOption,
  CommunityAgentRuntimeThinking,
} from "./agent-runtime-catalog-entry.js";

export interface CommunityAgentRuntimeAgent {
  id: string;
  label: string;
  mcpTransport?: string;
  catalog?: CommunityAgentRuntimeCatalog;
}

export interface CommunityAgentRuntimeState {
  agentId: string;
  host: { id: string; kind: string; workspace?: string };
  runtimeAgents: readonly CommunityAgentRuntimeAgent[];
  configured: { runtimeAgent: string; model?: string; thinking?: string };
  saved?: {
    runtimeAgent?: string;
    model?: string;
    thinking?: string;
    updatedAt?: number;
  } | null;
  effective: { runtimeAgent: string; model?: string; thinking?: string };
  catalog: CommunityAgentRuntimeCatalog;
  tools: readonly { name: string; effect: "read" | "write" }[];
  bootstrapRevision?: string | null;
  memory: { enabled: boolean; candidates: number };
}
