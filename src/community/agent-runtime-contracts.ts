export interface CommunityAgentRuntimeOption {
  value: string;
  name: string;
  description?: string;
}

export interface CommunityAgentRuntimeCatalogOption {
  id: string;
  name: string;
  category?: string;
  currentValue?: string | boolean;
  options?: readonly CommunityAgentRuntimeOption[];
}

export interface CommunityAgentRuntimeCatalog {
  agent: string;
  currentModel?: string;
  models: readonly string[];
  configOptions: readonly CommunityAgentRuntimeCatalogOption[];
  error?: string;
}

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

export type CommunityAgentRuntimeThinking = "off" | "low" | "medium" | "high";
