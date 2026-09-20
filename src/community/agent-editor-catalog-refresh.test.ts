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

  it("loads runtime again when the selected harness catalog is empty", () => {
    const pendingCursor = {
      ...emptyRuntime,
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
        { id: "cursor", label: "Cursor" },
      ],
      catalog: {
        agent: "codex",
        currentModel: "gpt-6",
        models: ["gpt-6"],
        configOptions: [],
      },
    };
    const load = vi.fn(async () => pendingCursor);
    const first = queueEditorRuntimeRefresh({
      open: true,
      pubkey: "agent",
      runtime: pendingCursor,
      runtimeAgent: "codex",
      requestedKey: "",
      load,
    });
    expect(first.task).toBeUndefined();
    const selected = queueEditorRuntimeRefresh({
      open: true,
      pubkey: "agent",
      runtime: pendingCursor,
      runtimeAgent: "cursor",
      requestedKey: first.requestedKey,
      load,
    });
    expect(selected.requestedKey).toBe("agent:cursor");
    expect(load).toHaveBeenCalledTimes(1);
  });
});
