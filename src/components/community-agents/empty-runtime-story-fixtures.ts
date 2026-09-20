import type { CommunityAgentRuntimeState } from "../../community/agent-runtime-contracts.js";
import { storyAgentRuntime } from "./runtime-story-fixtures.js";

export const storyEmptyCatalogRuntime: CommunityAgentRuntimeState = {
  ...storyAgentRuntime,
  catalog: {
    agent: storyAgentRuntime.catalog.agent,
    models: [],
    configOptions: [],
  },
  runtimeAgents: storyAgentRuntime.runtimeAgents.map((entry) => ({
    id: entry.id,
    label: entry.label,
    ...(entry.mcpTransport ? { mcpTransport: entry.mcpTransport } : {}),
  })),
};
