import { describe, expect, it } from "vitest";
import { editorCombinedModelRows } from "./agent-editor-model-rows.js";
import { editorRuntimeSaveInput } from "./agent-editor-runtime-save.js";
import type { CommunityAgentRuntimeState } from "./agent-runtime-contracts.js";

const runtime: CommunityAgentRuntimeState = {
  agentId: "agent-research",
  host: { id: "workspace", kind: "managed" },
  runtimeAgents: [
    {
      id: "codex",
      label: "Codex",
      catalog: {
        agent: "codex",
        currentModel: "gpt-6",
        models: ["gpt-6"],
        configOptions: [
          {
            id: "model",
            name: "Model",
            category: "model",
            options: [{ value: "gpt-6", name: "GPT-6" }],
          },
        ],
      },
    },
    { id: "cursor", label: "Cursor" },
    {
      id: "opencode",
      label: "OpenCode",
      catalog: {
        agent: "opencode",
        models: [],
        configOptions: [],
        error: "Runtime catalog unavailable for this harness",
      },
    },
  ],
  configured: { runtimeAgent: "codex", model: "gpt-6" },
  effective: { runtimeAgent: "codex", model: "gpt-6" },
  catalog: {
    agent: "codex",
    currentModel: "gpt-6",
    models: ["gpt-6"],
    configOptions: [],
  },
  tools: [],
  memory: { enabled: false, candidates: 0 },
};

describe("combined model rows", () => {
  it("flattens advertised catalogs and keeps empty harness rows", () => {
    expect(editorCombinedModelRows(runtime)).toEqual([
      {
        runtimeAgent: "codex",
        model: "gpt-6",
        name: "GPT-6",
        harnessLabel: "Codex",
        keywords: ["GPT-6", "gpt-6", "Codex", "codex"],
      },
      {
        runtimeAgent: "cursor",
        model: "",
        name: "Loading models…",
        harnessLabel: "Cursor",
        keywords: ["Loading models…", "Cursor", "cursor"],
        disabled: true,
      },
      {
        runtimeAgent: "opencode",
        model: "",
        name: "No models for this harness",
        harnessLabel: "OpenCode",
        keywords: ["No models for this harness", "OpenCode", "opencode"],
        disabled: true,
      },
    ]);
  });

  it("saves thinking only when the field is advertised", () => {
    expect(
      editorRuntimeSaveInput(
        "cursor",
        { model: "composer-2.5", thinking: "medium" },
        [],
      ),
    ).toEqual({ runtimeAgent: "cursor", model: "composer-2.5" });
    expect(
      editorRuntimeSaveInput("codex", { model: "gpt-6", thinking: "medium" }, [
        { value: "medium", name: "Medium" },
      ]),
    ).toEqual({
      runtimeAgent: "codex",
      model: "gpt-6",
      thinking: "medium",
    });
  });
});
