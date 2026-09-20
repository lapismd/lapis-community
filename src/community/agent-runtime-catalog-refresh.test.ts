import { describe, expect, it } from "vitest";
import { runtimeCatalogNeedsRefresh } from "./agent-runtime-catalog-refresh.js";
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
        configOptions: [],
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

describe("runtimeCatalogNeedsRefresh", () => {
  it("refreshes runtime when no harness catalog has models", () => {
    expect(runtimeCatalogNeedsRefresh(undefined)).toBe(true);
    expect(runtimeCatalogNeedsRefresh(runtime)).toBe(false);
    expect(
      runtimeCatalogNeedsRefresh({
        ...runtime,
        catalog: { ...runtime.catalog, models: [] },
        runtimeAgents: [{ id: "codex", label: "Codex" }],
      }),
    ).toBe(true);
  });

  it("refreshes the selected harness when that catalog is still empty", () => {
    expect(runtimeCatalogNeedsRefresh(runtime, "codex")).toBe(false);
    expect(
      runtimeCatalogNeedsRefresh(
        {
          ...runtime,
          runtimeAgents: [
            ...runtime.runtimeAgents,
            { id: "cursor", label: "Cursor" },
          ],
        },
        "cursor",
      ),
    ).toBe(true);
  });
});
