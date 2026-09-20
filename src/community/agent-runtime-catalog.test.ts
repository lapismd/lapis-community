import { describe, expect, it } from "vitest";
import { parseRuntimeState } from "./agent-state-parsers.js";
import {
  resolveRuntimeCatalog,
  runtimeModelOptions,
  runtimeSelectionForCatalog,
} from "./agent-runtime-catalog.js";
import type { CommunityAgentRuntimeState } from "./agent-runtime-contracts.js";

const cursorCatalog = {
  agent: "cursor",
  currentModel: "composer-2.5",
  models: ["composer-2.5", "composer-2.5-fast"],
  configOptions: [
    {
      id: "model",
      name: "Model",
      category: "model",
      currentValue: "composer-2.5",
      options: [
        { value: "composer-2.5", name: "Composer 2.5" },
        { value: "composer-2.5-fast", name: "Composer 2.5 Fast" },
      ],
    },
  ],
};

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
        models: ["gpt-6", "gpt-5.6"],
        configOptions: [
          {
            id: "model",
            name: "Model",
            category: "model",
            currentValue: "gpt-6",
            options: [
              { value: "gpt-6", name: "GPT-6" },
              { value: "gpt-5.6", name: "GPT-5.6" },
            ],
          },
        ],
      },
    },
    { id: "cursor", label: "Cursor", catalog: cursorCatalog },
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

describe("runtime catalog selection", () => {
  it("uses the selected harness catalog instead of the effective snapshot", () => {
    expect(
      runtimeModelOptions(resolveRuntimeCatalog(runtime, "cursor")).map(
        (option) => option.value,
      ),
    ).toEqual(["composer-2.5", "composer-2.5-fast"]);
    expect(
      runtimeSelectionForCatalog(resolveRuntimeCatalog(runtime, "cursor"), {
        model: "gpt-6",
        thinking: "medium",
      }),
    ).toEqual({ model: "composer-2.5", thinking: "medium" });
  });

  it("falls back to the top-level catalog for the matching harness", () => {
    const legacy = {
      ...runtime,
      runtimeAgents: [{ id: "codex", label: "Codex" }],
    };
    expect(resolveRuntimeCatalog(legacy, "codex")).toEqual(legacy.catalog);
    expect(resolveRuntimeCatalog(legacy, "cursor")).toMatchObject({
      agent: "cursor",
      models: [],
      error: "Runtime catalog unavailable for this harness",
    });
  });

  it("keeps per-harness catalogs when parsing runtime_state", () => {
    expect(
      parseRuntimeState({
        agentId: "agent-research",
        host: { id: "workspace", kind: "managed" },
        runtimeAgents: [
          { id: "codex", label: "Codex", catalog: runtime.catalog },
          { id: "cursor", label: "Cursor", catalog: cursorCatalog },
        ],
        configured: { runtimeAgent: "codex", model: "gpt-6" },
        effective: { runtimeAgent: "codex", model: "gpt-6" },
        catalog: runtime.catalog,
        tools: [],
        memory: { enabled: false, candidates: 0 },
      })?.runtimeAgents.map((entry) => [entry.id, entry.catalog?.currentModel]),
    ).toEqual([
      ["codex", "gpt-6"],
      ["cursor", "composer-2.5"],
    ]);
  });
});
