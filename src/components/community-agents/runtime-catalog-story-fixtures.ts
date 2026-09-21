import type {
  CommunityAgentRuntimeCatalog,
  CommunityAgentRuntimeOption,
} from "../../community/agent-runtime-contracts.js";

export function storyCatalog(
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

export const storyCodexCatalog = storyCatalog("codex", "gpt-6", [
  { value: "gpt-6", name: "GPT-6" },
  { value: "gpt-5.6", name: "GPT-5.6" },
]);
export const storyClaudeCatalog = storyCatalog("claude", "claude-sonnet", [
  { value: "claude-sonnet", name: "Claude Sonnet" },
  { value: "claude-opus", name: "Claude Opus" },
]);
export const storyCursorCatalog = storyCatalog(
  "cursor",
  "composer-2.5",
  [
    { value: "composer-2.5", name: "Composer 2.5" },
    { value: "composer-2.5-fast", name: "Composer 2.5 Fast" },
  ],
  [],
);
export const storyOpencodeCatalog = storyCatalog(
  "opencode",
  "opencode/gpt-5",
  [{ value: "opencode/gpt-5", name: "GPT-5" }],
  [
    { value: "high", name: "High" },
    { value: "xhigh", name: "Extra high" },
  ],
);
