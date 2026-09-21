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

export interface CommunityAgentRuntimeCatalogEntry {
  id: string;
  label?: string;
  thinkingValues?: readonly CommunityAgentRuntimeThinking[];
  configOptions?: readonly CommunityAgentRuntimeCatalogOption[];
}

export interface CommunityAgentRuntimeCatalog {
  agent: string;
  currentModel?: string;
  models: readonly string[];
  entries?: readonly CommunityAgentRuntimeCatalogEntry[];
  configOptions: readonly CommunityAgentRuntimeCatalogOption[];
  error?: string;
}

export type CommunityAgentRuntimeThinking =
  | "off"
  | "low"
  | "medium"
  | "high"
  | "xhigh";
