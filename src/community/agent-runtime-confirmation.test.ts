import { expect, it } from "vitest";
import { confirmedRuntimeSettings } from "./agent-runtime-confirmation.js";
import type { CommunityAgentRuntimeState } from "./agent-runtime-contracts.js";
const runtime: CommunityAgentRuntimeState = {
  agentId: "agent",
  host: { id: "host", kind: "local" },
  runtimeAgents: [],
  configured: { runtimeAgent: "codex" },
  effective: { runtimeAgent: "codex" },
  catalog: { agent: "codex", models: [], configOptions: [] },
  tools: [],
  memory: { enabled: false, candidates: 0 },
};
it("rejects old controllers silently omitting policy acknowledgements", () => {
  expect(() =>
    confirmedRuntimeSettings({ approvalPolicy: "allow-all" }, runtime),
  ).toThrow(/did not confirm/);
});
it("accepts confirmed explicit Ask but rejects a mismatched effective policy", () => {
  const confirmed = {
    ...runtime,
    effective: { ...runtime.effective, approvalPolicy: "ask" as const },
    saved: { approvalPolicy: "ask" as const },
  };
  expect(confirmedRuntimeSettings({ approvalPolicy: "ask" }, confirmed)).toBe(
    confirmed,
  );
  expect(() =>
    confirmedRuntimeSettings({ approvalPolicy: "allow-all" }, confirmed),
  ).toThrow(/did not confirm/);
});
