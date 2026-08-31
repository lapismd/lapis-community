import { afterEach, describe, expect, it, vi } from "vitest";

import { loadDashboard } from "./api.js";

function jsonResponse(
  body: unknown,
  headerName: string,
  root: string,
): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
      [headerName]: root,
      "x-lapis-registry-unsigned": "true",
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("registry dashboard API", () => {
  it("validates each projection against its own response root", async () => {
    const registryRoot = "a".repeat(64);
    const communityRoot = "b".repeat(64);
    const securityRoot = "c".repeat(64);
    const responses = [
      jsonResponse(
        {
          schemaVersion: 1,
          generatedAt: new Date(0).toISOString(),
          plugins: [],
        },
        "x-lapis-registry-root",
        registryRoot,
      ),
      jsonResponse(
        {
          backend: "nostr",
          root: registryRoot,
          acceptedEventIds: [],
          exclusionCounts: {},
          sourceCounts: {},
          issues: [],
        },
        "x-lapis-registry-root",
        registryRoot,
      ),
      jsonResponse(
        {
          root: communityRoot,
          ratingAggregates: [],
          reviews: [],
          reports: [],
          collections: [],
          followLists: [],
          exclusionCounts: { hiddenEvent: 0, mutedPubkey: 0 },
          issues: [],
        },
        "x-lapis-community-root",
        communityRoot,
      ),
      jsonResponse(
        { root: securityRoot, statuses: [], issues: [] },
        "x-lapis-security-root",
        securityRoot,
      ),
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => responses.shift() ?? new Response(null, { status: 500 }),
      ),
    );

    const dashboard = await loadDashboard("http://registry.test/");

    expect(dashboard.responseRoot).toBe(registryRoot);
    expect(dashboard.communityRoot).toBe(communityRoot);
    expect(dashboard.securityRoot).toBe(securityRoot);
    expect(dashboard.unsigned).toBe(true);
  });

  it("rejects a stale community response", async () => {
    const registryRoot = "a".repeat(64);
    const communityRoot = "b".repeat(64);
    const responses = [
      jsonResponse(
        {
          schemaVersion: 1,
          generatedAt: new Date(0).toISOString(),
          plugins: [],
        },
        "x-lapis-registry-root",
        registryRoot,
      ),
      jsonResponse(
        {
          backend: "nostr",
          root: registryRoot,
          acceptedEventIds: [],
          exclusionCounts: {},
          sourceCounts: {},
          issues: [],
        },
        "x-lapis-registry-root",
        registryRoot,
      ),
      jsonResponse(
        {
          root: communityRoot,
          ratingAggregates: [],
          reviews: [],
          reports: [],
          collections: [],
          followLists: [],
          exclusionCounts: { hiddenEvent: 0, mutedPubkey: 0 },
          issues: [],
        },
        "x-lapis-community-root",
        "d".repeat(64),
      ),
      jsonResponse(
        { root: "c".repeat(64), statuses: [], issues: [] },
        "x-lapis-security-root",
        "c".repeat(64),
      ),
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => responses.shift() ?? new Response(null, { status: 500 }),
      ),
    );

    await expect(loadDashboard("http://registry.test/")).rejects.toThrow(
      "Community projection root",
    );
  });
});
