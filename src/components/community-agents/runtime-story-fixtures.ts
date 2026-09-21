import type { CommunityAgentRuntimeState } from "../../community/agent-runtime-contracts.js";
import {
  storyClaudeCatalog,
  storyCodexCatalog,
  storyCursorCatalog,
  storyOpencodeCatalog,
} from "./runtime-catalog-story-fixtures.js";

export const storyAgentRuntime: CommunityAgentRuntimeState = {
  agentId: "agent-research",
  host: {
    id: "local-workspace",
    kind: "managed",
    workspace:
      "/Users/operator/.lapis/community/agents/0123456789abcdef/workspace",
  },
  runtimeAgents: [
    {
      id: "codex",
      label: "Codex",
      mcpTransport: "stdio",
      catalog: storyCodexCatalog,
    },
    {
      id: "claude",
      label: "Claude Code",
      mcpTransport: "stdio",
      catalog: storyClaudeCatalog,
    },
    {
      id: "cursor",
      label: "Cursor",
      mcpTransport: "stdio",
      catalog: storyCursorCatalog,
    },
    {
      id: "opencode",
      label: "OpenCode",
      mcpTransport: "stdio",
      catalog: storyOpencodeCatalog,
    },
  ],
  configured: { runtimeAgent: "codex", model: "gpt-6", thinking: "medium" },
  saved: null,
  effective: { runtimeAgent: "codex", model: "gpt-6", thinking: "medium" },
  catalog: storyCodexCatalog,
  tools: [
    { name: "relay.messages.list", effect: "read" },
    { name: "relay.issues.create", effect: "write" },
    { name: "memory.search", effect: "read" },
  ],
  bootstrapRevision: "persona:release-notes:7",
  memory: { enabled: true, candidates: 1 },
};

export const storyPendingCatalogRuntime: CommunityAgentRuntimeState = {
  ...storyAgentRuntime,
  runtimeAgents: storyAgentRuntime.runtimeAgents.map((entry) =>
    entry.id === "cursor"
      ? {
          id: entry.id,
          label: entry.label,
          ...(entry.mcpTransport ? { mcpTransport: entry.mcpTransport } : {}),
        }
      : entry,
  ),
};
