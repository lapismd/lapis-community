import { describe, expect, it } from "vitest";
import { editorCombinedModelRows } from "./agent-editor-model-rows.js";
import {
  editorHarnessTab,
  editorHarnessTabs,
  editorRowsForHarness,
} from "./agent-editor-harness-tabs.js";
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
  catalog: { agent: "codex", models: ["gpt-6"], configOptions: [] },
  tools: [],
  memory: { enabled: false, candidates: 0 },
};

describe("editor harness tabs", () => {
  it("scopes visible models to the chosen harness tab", () => {
    const rows = editorCombinedModelRows(runtime);
    const tabs = editorHarnessTabs(rows);
    expect(tabs.map((tab) => tab.id)).toEqual(["codex", "cursor", "opencode"]);
    expect(editorHarnessTab(tabs, "", "codex")).toBe("codex");
    expect(editorHarnessTab(tabs, "cursor", "codex")).toBe("cursor");
    expect(editorRowsForHarness(rows, "codex").map((row) => row.model)).toEqual(
      ["gpt-6"],
    );
    expect(editorRowsForHarness(rows, "cursor")[0]).toMatchObject({
      disabled: true,
      name: "Loading models…",
    });
  });
});
