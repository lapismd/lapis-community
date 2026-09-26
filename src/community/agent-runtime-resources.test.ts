import { expect, it } from "vitest";
import { parseAgentRuntimeResources } from "./agent-runtime-resources.js";

it("accepts validated provider-shared worker and memory totals", () => {
  expect(
    parseAgentRuntimeResources({
      scope: "provider-shared",
      providerId: "opencode",
      status: "partial",
      observedAt: 123,
      workers: { busy: 1, idle: 2, starting: 0, stopping: 0 },
      sessions: 4,
      rssBytes: 8_388_608,
    }),
  ).toMatchObject({
    status: "partial",
    rssBytes: 8_388_608,
    workers: { busy: 1 },
  });
});

it("rejects malformed or unscoped resource data", () => {
  const base = {
    scope: "provider-shared",
    providerId: "opencode",
    status: "available",
    observedAt: 123,
    workers: { busy: 1, idle: 0, starting: 0, stopping: 0 },
    sessions: 1,
    rssBytes: 1024,
  };
  expect(
    parseAgentRuntimeResources({ ...base, scope: "agent-private" }),
  ).toBeUndefined();
  expect(
    parseAgentRuntimeResources({
      ...base,
      workers: { ...base.workers, busy: -1 },
    }),
  ).toBeUndefined();
  expect(
    parseAgentRuntimeResources({ ...base, status: "unavailable" })?.rssBytes,
  ).toBeNull();
});
