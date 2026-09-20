import { describe, expect, it, vi } from "vitest";
import { queueEditorRuntimeRefresh } from "./agent-editor-catalog-refresh.js";
import type { CommunityAgentRuntimeState } from "./agent-runtime-contracts.js";

const emptyRuntime: CommunityAgentRuntimeState = {
  agentId: "agent-research",
  host: { id: "workspace", kind: "managed" },
  runtimeAgents: [{ id: "codex", label: "Codex" }],
  configured: { runtimeAgent: "codex" },
  effective: { runtimeAgent: "codex" },
  catalog: { agent: "codex", models: [], configOptions: [] },
  tools: [],
  memory: { enabled: false, candidates: 0 },
};

describe("queueEditorRuntimeRefresh", () => {
  it("loads runtime once when the cached catalog is empty", () => {
    const load = vi.fn(async () => emptyRuntime);
    const first = queueEditorRuntimeRefresh({
      open: true,
      pubkey: "agent",
      runtime: emptyRuntime,
      requestedKey: "",
      load,
    });
    expect(first.requestedKey).toBe("agent");
    expect(load).toHaveBeenCalledTimes(1);
    const second = queueEditorRuntimeRefresh({
      open: true,
      pubkey: "agent",
      runtime: emptyRuntime,
      requestedKey: first.requestedKey,
      load,
    });
    expect(second.task).toBeUndefined();
    expect(load).toHaveBeenCalledTimes(1);
  });
});
