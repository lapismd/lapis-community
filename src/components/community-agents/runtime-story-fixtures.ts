import type {
  CommunityAgentRuntimeCatalog,
  CommunityAgentRuntimeOption,
  CommunityAgentRuntimeState,
} from "../../community/agent-runtime-contracts.js";

function storyCatalog(
  agent: string,
  currentModel: string,
  models: readonly CommunityAgentRuntimeOption[],
  thinking: readonly CommunityAgentRuntimeOption[] = [
    { value: "low", name: "Low" },
    { value: "medium", name: "Medium" },
    { value: "high", name: "High" },
  ],
): CommunityAgentRuntimeCatalog {
  return {
    agent,
    currentModel,
    models: models.map((model) => model.value),
    configOptions: [
      {
        id: "model",
        name: "Model",
        category: "model",
        currentValue: currentModel,
        options: models,
      },
      ...(thinking.length
        ? [
            {
              id: "reasoning_effort",
              name: "Thinking",
              category: "thought",
              currentValue: "medium",
              options: thinking,
            },
          ]
        : []),
    ],
  };
}

const codexCatalog = storyCatalog("codex", "gpt-6", [
  { value: "gpt-6", name: "GPT-6" },
  { value: "gpt-5.6", name: "GPT-5.6" },
]);
const claudeCatalog = storyCatalog("claude", "claude-sonnet", [
  { value: "claude-sonnet", name: "Claude Sonnet" },
  { value: "claude-opus", name: "Claude Opus" },
]);
const cursorCatalog = storyCatalog("cursor", "composer-2.5", [
  { value: "composer-2.5", name: "Composer 2.5" },
  { value: "composer-2.5-fast", name: "Composer 2.5 Fast" },
]);

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
      catalog: codexCatalog,
    },
    {
      id: "claude",
      label: "Claude Code",
      mcpTransport: "stdio",
      catalog: claudeCatalog,
    },
    {
      id: "cursor",
      label: "Cursor",
      mcpTransport: "stdio",
      catalog: cursorCatalog,
    },
  ],
  configured: { runtimeAgent: "codex", model: "gpt-6", thinking: "medium" },
  saved: null,
  effective: { runtimeAgent: "codex", model: "gpt-6", thinking: "medium" },
  catalog: codexCatalog,
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
