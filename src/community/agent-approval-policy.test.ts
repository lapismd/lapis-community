import { describe, expect, it } from "vitest";
import { optionalRuntimeDefaults } from "./agent-runtime-defaults-parse.js";
import { assertRuntimeSet } from "./agent-runtime-set.js";
import { editorRuntimePermissionSave } from "./agent-runtime-permission.js";
import { editorRuntimeLoadKey } from "./agent-editor-runtime-load.js";
const storyAgentRuntime = {
  agentId: "agent",
  host: { id: "host", kind: "local" },
  runtimeAgents: [],
  configured: { runtimeAgent: "codex" },
  effective: { runtimeAgent: "codex" },
  catalog: { agent: "codex", models: [], configOptions: [] },
  tools: [],
  memory: { enabled: false, candidates: 0 },
};

describe("provider-independent approval policy", () => {
  it.each(["ask", "allow-all"] as const)(
    "parses and sends explicit %s without a provider mode",
    (approvalPolicy) => {
      expect(optionalRuntimeDefaults({ approvalPolicy })).toEqual({
        approvalPolicy,
      });
      expect(() =>
        assertRuntimeSet({
          version: 2,
          command: "runtime_set",
          requestId: "control",
          approvalPolicy,
        } as Parameters<typeof assertRuntimeSet>[0]),
      ).not.toThrow();
    },
  );
  it("migrates a legacy missing Ask value to an explicit Allow all choice on save", () => {
    expect(
      editorRuntimePermissionSave("codex", { model: "model" }, [], []),
    ).toEqual({
      runtimeAgent: "codex",
      model: "model",
      approvalPolicy: "allow-all",
    });
  });
  it("retains an explicit Ask independently of native catalog choices", () => {
    const selection = { approvalPolicy: "ask" as const, model: "model" };
    expect(editorRuntimePermissionSave("cursor", selection, [], [])).toEqual({
      runtimeAgent: "cursor",
      model: "model",
      approvalPolicy: "ask",
    });
  });
  it("reloads an editor when only policy changes", () => {
    const runtime = {
      ...storyAgentRuntime,
      effective: {
        ...storyAgentRuntime.effective,
        approvalPolicy: "ask" as const,
      },
    };
    expect(editorRuntimeLoadKey(runtime)).not.toBe(
      editorRuntimeLoadKey({
        ...runtime,
        effective: { ...runtime.effective, approvalPolicy: "allow-all" },
      }),
    );
  });
});
