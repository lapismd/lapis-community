import type { CommunityAgentRuntimeState } from "../../community/agent-runtime-contracts.js";
import { storyAgentRuntime } from "./runtime-story-fixtures.js";

const models = [
  { value: "composer-2.5", name: "Composer 2.5" },
  { value: "composer-2.5-fast", name: "Composer 2.5 Fast" },
  { value: "grok-4.6", name: "Grok 4.6" },
  { value: "claude-4.6-sonnet", name: "Claude 4.6 Sonnet" },
  { value: "claude-opus-4.1", name: "Claude Opus 4.1" },
  { value: "gpt-5.4", name: "GPT-5.4" },
  { value: "gpt-5.3-codex", name: "GPT-5.3 Codex" },
  { value: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
  { value: "kimi-k2.5", name: "Kimi K2.5" },
  { value: "auto", name: "Auto" },
  { value: "cursor-small", name: "Cursor Small" },
];

const catalog = {
  agent: "cursor",
  currentModel: "composer-2.5",
  models: models.map((model) => model.value),
  configOptions: [
    {
      id: "model",
      name: "Model",
      category: "model",
      currentValue: "composer-2.5",
      options: models,
    },
    ...(storyAgentRuntime.runtimeAgents
      .find((entry) => entry.id === "cursor")
      ?.catalog?.configOptions.filter(
        (option) => option.category !== "model",
      ) ?? []),
  ],
};

export const storyLongCursorRuntime: CommunityAgentRuntimeState = {
  ...storyAgentRuntime,
  runtimeAgents: storyAgentRuntime.runtimeAgents.map((entry) =>
    entry.id === "cursor" ? { ...entry, catalog } : entry,
  ),
};
