import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from "nostr-tools/pure";
import { describe, expect, it } from "vitest";

import {
  createSnapshotContent,
  eventAddress,
  materializeRegistry,
  TEST_COMMUNITY_KINDS,
  TEST_REGISTRY_KINDS,
  TEST_SECURITY_KINDS,
} from "@lapismd/registry-protocol";
import type {
  ApprovalContent,
  AssessmentContent,
  NostrEvent,
  PluginDefinitionContent,
  RegistryAuthorities,
  ReleaseContent,
} from "@lapismd/registry-protocol";

import {
  loadVerifiedRegistrySnapshot,
  loadRelayRegistryState,
  MemoryRegistryCache,
  PublicationQuorumError,
  publishWithQuorum,
  resolveExactEvents,
  selectCompleteRegistry,
} from "./index.js";
import type {
  RegistryRelay,
  RelayFilter,
  RelayPublishResult,
} from "./transport.js";

const publisherKey = generateSecretKey();
const assessorKey = generateSecretKey();
const curatorKey = generateSecretKey();
const snapshotKey = generateSecretKey();
const publisher = getPublicKey(publisherKey);
const assessor = getPublicKey(assessorKey);
const curator = getPublicKey(curatorKey);
const snapshotSigner = getPublicKey(snapshotKey);

const authorities: RegistryAuthorities = {
  assessorPubkeys: new Set([assessor]),
  curatorPubkeys: new Set([curator]),
  moderatorPubkeys: new Set(),
  snapshotSignerPubkeys: new Set([snapshotSigner]),
  registryOperatorPubkeys: new Set([curator]),
};

function signed(
  secret: Uint8Array,
  kind: number,
  created_at: number,
  tags: string[][],
  content: object,
): NostrEvent {
  return finalizeEvent(
    { kind, created_at, tags, content: JSON.stringify(content) },
    secret,
  );
}

function registryEvents(): {
  events: NostrEvent[];
  snapshot: NostrEvent;
} {
  const pluginContent: PluginDefinitionContent = {
    schema: "lapis.registry.plugin/1",
    pluginId: "demo",
    name: "Demo",
    description: "Fixture plugin",
    channel: "official",
    status: "active",
    index: { schemaVersion: 1 },
    detail: { schemaVersion: 1 },
  };
  const plugin = signed(
    publisherKey,
    TEST_REGISTRY_KINDS.softwareApplication,
    1_800_000_000,
    [["d", "demo"]],
    pluginContent,
  );
  const sha256 = "ef".repeat(32);
  const releaseContent: ReleaseContent = {
    schema: "lapis.registry.release/1",
    pluginId: "demo",
    version: "1.0.0",
    minAppVersion: "0.1.0",
    platforms: ["web"],
    releasedAt: "2026-08-31T12:00:00.000Z",
    artifact: {
      url: "https://example.test/demo.lapis-plugin",
      sha256,
      size: 100,
    },
    metadata: {},
  };
  const release = signed(
    publisherKey,
    TEST_REGISTRY_KINDS.releaseArtifactSet,
    1_800_000_001,
    [
      ["d", "demo@1.0.0"],
      [
        "a",
        eventAddress(
          TEST_REGISTRY_KINDS.softwareApplication,
          publisher,
          "demo",
        ),
      ],
      ["x", sha256],
    ],
    releaseContent,
  );
  const assessmentContent: AssessmentContent = {
    schema: "lapis.registry.assessment/1",
    releaseEventId: release.id,
    artifactSha256: sha256,
    status: "pass",
    checks: [{ id: "fixture", status: "pass" }],
  };
  const assessment = signed(
    assessorKey,
    TEST_REGISTRY_KINDS.assessmentLabel,
    1_800_000_002,
    [
      ["e", release.id, "", "release"],
      ["x", sha256],
    ],
    assessmentContent,
  );
  const approvalContent: ApprovalContent = {
    schema: "lapis.registry.approval/1",
    pluginId: "demo",
    version: "1.0.0",
    releaseEventId: release.id,
    assessmentEventId: assessment.id,
    artifactSha256: sha256,
    decision: "approved",
  };
  const approval = signed(
    curatorKey,
    TEST_REGISTRY_KINDS.approval,
    1_800_000_003,
    [
      ["d", "demo@1.0.0"],
      ["e", release.id, "", "release"],
      ["e", assessment.id, "", "assessment"],
      ["x", sha256],
    ],
    approvalContent,
  );
  const events = [plugin, release, assessment, approval];
  const materialized = materializeRegistry(
    events,
    TEST_REGISTRY_KINDS,
    authorities,
  );
  const snapshotContent = createSnapshotContent(
    materialized,
    "2026-08-31T12:05:00.000Z",
  );
  const snapshot = signed(
    snapshotKey,
    TEST_REGISTRY_KINDS.snapshot,
    1_800_000_004,
    [
      ["d", "official"],
      ["x", materialized.root],
    ],
    snapshotContent,
  );
  return { events, snapshot };
}

class FakeRelay implements RegistryRelay {
  readonly url: string;
  readonly #events: NostrEvent[];
  readonly #publishResult: RelayPublishResult | Error;

  constructor(
    url: string,
    events: NostrEvent[] = [],
    publishResult: RelayPublishResult | Error = {
      accepted: true,
      message: "saved",
    },
  ) {
    this.url = url;
    this.#events = events;
    this.#publishResult = publishResult;
  }

  async query(filter: RelayFilter): Promise<NostrEvent[]> {
    return this.#events
      .filter(
        (event) =>
          (filter.ids === undefined || filter.ids.includes(event.id)) &&
          (filter.kinds === undefined || filter.kinds.includes(event.kind)) &&
          (filter.authors === undefined ||
            filter.authors.includes(event.pubkey)),
      )
      .slice(0, filter.limit);
  }

  async publish(): Promise<RelayPublishResult> {
    if (this.#publishResult instanceof Error) throw this.#publishResult;
    return this.#publishResult;
  }

  close(): void {}
}

describe("registry relay behavior", () => {
  it("requires two accepted writes in the three-relay official set", async () => {
    const { events } = registryEvents();
    const relays = [
      new FakeRelay("wss://one.test"),
      new FakeRelay("wss://two.test"),
      new FakeRelay("wss://three.test", [], new Error("offline")),
    ];

    await expect(
      publishWithQuorum(events[0]!, relays, 2),
    ).resolves.toMatchObject({
      required: 2,
      accepted: 2,
    });

    await expect(
      publishWithQuorum(
        events[0]!,
        [
          relays[0]!,
          new FakeRelay("wss://four.test", [], new Error("offline")),
          new FakeRelay("wss://five.test", [], new Error("offline")),
        ],
        2,
      ),
    ).rejects.toBeInstanceOf(PublicationQuorumError);
  });

  it("resolves an exact event set across relays without hiding provenance", async () => {
    const { events } = registryEvents();
    const result = await resolveExactEvents(
      events.map((event) => event.id),
      [
        new FakeRelay("wss://one.test", events.slice(0, 2)),
        new FakeRelay("wss://two.test", events.slice(2)),
      ],
    );

    expect(result.missingEventIds).toEqual([]);
    expect(result.events.map((event) => event.id).toSorted()).toEqual(
      events.map((event) => event.id).toSorted(),
    );
    expect(result.relays).toEqual([
      {
        relay: "wss://one.test",
        eventIds: events
          .slice(0, 2)
          .map((event) => event.id)
          .toSorted(),
      },
      {
        relay: "wss://two.test",
        eventIds: events
          .slice(2)
          .map((event) => event.id)
          .toSorted(),
      },
    ]);
  });

  it("loads only a complete event set whose signed snapshot root verifies", async () => {
    const { events, snapshot } = registryEvents();
    const loaded = await loadVerifiedRegistrySnapshot(
      [
        new FakeRelay("wss://one.test", [snapshot, ...events.slice(0, 2)]),
        new FakeRelay("wss://two.test", events.slice(2)),
        new FakeRelay("wss://three.test"),
      ],
      TEST_REGISTRY_KINDS,
      authorities,
    );

    expect(loaded.snapshotEvent.id).toBe(snapshot.id);
    expect(loaded.registry.plugins[0]?.content.pluginId).toBe("demo");
    expect(loaded.registry.acceptedEventIds).toEqual(
      events.map((event) => event.id).toSorted(),
    );
  });

  it("derives the dashboard projection directly from verified relay events", async () => {
    const { events, snapshot } = registryEvents();
    const loaded = await loadRelayRegistryState({
      officialRelays: [
        new FakeRelay("wss://official.test", [snapshot, ...events]),
      ],
      communityRelays: [new FakeRelay("wss://community.test")],
      kinds: TEST_REGISTRY_KINDS,
      communityKinds: TEST_COMMUNITY_KINDS,
      securityKinds: TEST_SECURITY_KINDS,
      authorities,
      securityAuthorities: {
        advisoryPubkeys: new Set(),
        dispositionPubkeys: new Set(),
      },
    });

    expect(loaded.registry.root).toBe(loaded.projection.provenance.root);
    expect(loaded.projection.index.plugins).toHaveLength(1);
    expect(loaded.sources.official[0]?.eventIds).toEqual(
      events.map((event) => event.id).toSorted(),
    );
    expect(loaded.community.ratingAggregates).toEqual([]);
    expect(loaded.security.statuses).toEqual([]);
  });
});

describe("complete registry fallback", () => {
  interface State {
    root: string;
    plugins: string[];
  }

  const complete = (state: State): boolean =>
    state.root.length > 0 && state.plugins.length > 0;

  it("uses a whole HTTP state when Nostr is incomplete and updates cache", async () => {
    const cache = new MemoryRegistryCache<State>({
      root: "old",
      plugins: ["cached"],
    });
    const http = { root: "http-root", plugins: ["one", "two"] };
    const selected = await selectCompleteRegistry({
      loadNostr: async () => ({ root: "partial", plugins: [] }),
      loadHttp: async () => http,
      cache,
      isComplete: complete,
    });

    expect(selected).toMatchObject({
      backend: "http",
      value: http,
      failures: [
        { backend: "nostr", message: "Registry state was incomplete" },
      ],
    });
    await expect(cache.read()).resolves.toEqual(http);
  });

  it("falls back to one last-known-good cached state", async () => {
    const cached = { root: "cached-root", plugins: ["cached"] };
    const selected = await selectCompleteRegistry({
      loadNostr: async () => {
        throw new Error("relay unavailable");
      },
      loadHttp: async () => {
        throw new Error("HTTP unavailable");
      },
      cache: new MemoryRegistryCache(cached),
      isComplete: complete,
    });

    expect(selected.backend).toBe("cache");
    expect(selected.value).toEqual(cached);
    expect(selected.failures.map((failure) => failure.backend)).toEqual([
      "nostr",
      "http",
    ]);
  });
});
