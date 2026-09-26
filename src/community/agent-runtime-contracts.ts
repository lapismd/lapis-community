import type { CommunityAgentRuntimeCatalog } from "./agent-runtime-catalog-entry.js";
import type { CommunityAgentRuntimeValues } from "./agent-runtime-values.js";

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
  configured: CommunityAgentRuntimeValues & { runtimeAgent: string };
  saved?: CommunityAgentRuntimeValues | null;
  effective: CommunityAgentRuntimeValues & { runtimeAgent: string };
  catalog: CommunityAgentRuntimeCatalog;
  tools: readonly { name: string; effect: "read" | "write" }[];
  bootstrapRevision?: string | null;
  memory: { enabled: boolean; candidates: number };
  resources?: CommunityAgentRuntimeResources;
}

export interface CommunityAgentRuntimeResources {
  scope: "provider-shared";
  providerId: string;
  status: "available" | "partial" | "unavailable";
  observedAt: number;
  workers: { busy: number; idle: number; starting: number; stopping: number };
  sessions: number;
  rssBytes: number | null;
}
