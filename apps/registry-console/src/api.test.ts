import { describe, expect, it } from "vitest";

import { dashboardFromRelayState, parseConsoleConfig } from "./api.js";

const baseConfig = {
  officialRelays: ["wss://official.example"],
  communityRelays: ["wss://community.example"],
  publishQuorum: 1,
  kinds: {
    softwareApplication: 32_267,
    releaseArtifactSet: 30_063,
    assessmentLabel: 1_985,
    approval: 64_000,
    revocation: 64_001,
    moderationReport: 1_984,
    moderationDecision: 64_003,
    snapshot: 64_002,
    fileMetadata: 1_063,
    comment: 1_111,
  },
  communityKinds: {
    rating: 64_006,
    comment: 1_111,
    reaction: 7,
    report: 1_984,
    followList: 3,
    appCurationSet: 30_267,
    softwareApplication: 32_267,
  },
  securityKinds: { advisory: 64_004, disposition: 64_005 },
  authorities: {
    assessorPubkeys: [],
    curatorPubkeys: [],
    moderatorPubkeys: [],
    snapshotSignerPubkeys: [],
    registryOperatorPubkeys: [],
  },
  securityAuthorities: { advisoryPubkeys: [], dispositionPubkeys: [] },
};

describe("registry relay console", () => {
  it("requires a quorum that fits the configured official relays", () => {
    expect(parseConsoleConfig(baseConfig)).toMatchObject({
      officialRelays: ["wss://official.example/"],
      communityRelays: ["wss://community.example/"],
      publishQuorum: 1,
    });
    expect(() =>
      parseConsoleConfig({ ...baseConfig, publishQuorum: 2 }),
    ).toThrow("Publish quorum");
  });

  it("builds provenance from relay copies rather than an API source", () => {
    const root = "a".repeat(64);
    const dashboard = dashboardFromRelayState({
      snapshot: {} as never,
      registry: {
        schemaVersion: 1,
        root,
        plugins: [],
        acceptedEventIds: ["event-one"],
        exclusions: [],
        exclusionCounts: {},
        issues: [],
      },
      projection: {
        index: {
          schemaVersion: 1,
          generatedAt: "2026-08-31T00:00:00.000Z",
          plugins: [],
        },
        plugins: new Map(),
        provenance: {
          backend: "nostr",
          root,
          acceptedEventIds: ["event-one"],
          exclusionCounts: {},
        },
      },
      community: {
        schemaVersion: 1,
        root: "b".repeat(64),
        ratings: [],
        ratingAggregates: [],
        reviews: [],
        reactions: [],
        reactionAggregates: [],
        reports: [],
        collections: [],
        followLists: [],
        exclusionCounts: { hiddenEvent: 0, mutedPubkey: 0 },
        issues: [],
      },
      security: {
        schemaVersion: 1,
        root: "c".repeat(64),
        statuses: [],
        acceptedEventIds: [],
        issues: [],
      },
      sources: {
        official: [
          { relay: "wss://official.example/", eventIds: ["event-one"] },
        ],
        community: [],
        security: [],
      },
    });

    expect(dashboard.provenance).toMatchObject({
      backend: "nostr-relay-quorum",
      sourceCounts: { "wss://official.example/": 1 },
    });
    expect(dashboard.unsigned).toBe(false);
  });
});
