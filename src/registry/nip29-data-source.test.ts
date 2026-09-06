import "fake-indexeddb/auto";

import { createHash } from "node:crypto";

import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from "nostr-tools/pure";
import { describe, expect, it, vi } from "vitest";

import { SecretKeyRegistrySigner } from "../auth/index.js";
import {
  createNip29CuratorDecisionTemplate,
  createNip29PublisherAuthorizationTemplate,
  createNip29RegistryHeadTemplate,
  createNip29ReleaseMessageTemplate,
  LAPIS_GROUPS,
  lapisGroupId,
  type NostrEvent,
  type NostrEventTemplate,
  type PluginDefinitionContent,
  type ReleaseContent,
} from "../protocol/index.js";
import { createInMemoryRelayFactory } from "../testing/index.js";
import { createNip29RegistryCatalogDataSource } from "./nip29-data-source.js";
import {
  createIndexedDbRegistrySnapshotStore,
  createMemoryRegistrySnapshotStore,
} from "./snapshot-store.js";

function sign(secret: Uint8Array, template: NostrEventTemplate): NostrEvent {
  return finalizeEvent(template, secret);
}

function sha(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function fixture() {
  const publisherKey = generateSecretKey();
  const curatorKey = generateSecretKey();
  const publisher = getPublicKey(publisherKey);
  const curator = getPublicKey(curatorKey);
  const imageBytes = new TextEncoder().encode("verified image bytes");
  const markdownBytes = new TextEncoder().encode("# Verified overview");
  const image = {
    url: `/registry/assets/demo/${sha(imageBytes)}.webp`,
    sourceUrl: `https://assets.example/registry/assets/demo/${sha(imageBytes)}.webp`,
    sha256: sha(imageBytes),
    size: imageBytes.byteLength,
    mediaType: "image/webp" as const,
    width: 1200,
    height: 800,
  };
  const markdown = {
    url: "/registry/content/demo/overview.md",
    sourceUrl: "https://assets.example/registry/content/demo/overview.md",
    sha256: sha(markdownBytes),
    size: markdownBytes.byteLength,
    mediaType: "text/markdown" as const,
  };
  const plugin: PluginDefinitionContent = {
    schema: "lapis.registry.plugin/1",
    pluginId: "demo",
    name: "Demo",
    description: "A relay-derived plugin",
    channel: "official",
    status: "active",
    index: {
      author: "Lapis",
      appearance: {
        icon: "sparkles",
        accent: "#A855F7",
        logo: { ...image, alt: "Demo" },
      },
      minAppVersion: "0.1.0",
      platforms: ["web"],
      categories: ["productivity"],
      badges: ["official"],
      owner: { name: "Lapis", verified: true },
    },
    detail: {
      schemaVersion: 1,
      author: "Lapis",
      appearance: {
        icon: "sparkles",
        accent: "#A855F7",
        logo: { ...image, alt: "Demo" },
      },
      media: {
        banner: {
          alt: "Demo banner",
          images: { preview: image, full: image, light: image, dark: image },
        },
      },
      owner: { name: "Lapis", verified: true },
      content: { overview: markdown },
    },
  };
  const releaseContent: ReleaseContent = {
    schema: "lapis.registry.release/1",
    pluginId: "demo",
    version: "1.0.0",
    minAppVersion: "0.1.0",
    platforms: ["web"],
    releasedAt: "2026-09-03T10:00:00.000Z",
    artifact: {
      url: "https://assets.example/demo.lapis-plugin",
      sha256: "b".repeat(64),
      size: 100,
    },
    metadata: {},
  };
  const manifest = {
    schema: "lapis.registry.nip29-release/1" as const,
    plugin,
    release: releaseContent,
  };
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
  const release = sign(
    publisherKey,
    createNip29ReleaseMessageTemplate(
      "demo",
      {
        url: "https://relay.example/manifest.json",
        mimeType: "application/json",
        sha256: sha(manifestBytes),
        size: manifestBytes.byteLength,
      },
      1_700_000_000,
      "Demo 1.0.0",
    ),
  );
  const approval = sign(
    curatorKey,
    createNip29CuratorDecisionTemplate(release.id, "approved", 1_700_000_001),
  );
  return {
    approval,
    curator,
    curatorKey,
    image,
    imageBytes,
    manifestBytes,
    markdown,
    markdownBytes,
    publisher,
    publisherKey,
    plugin,
    release,
    releaseContent,
  };
}

function sequencedFixture() {
  const data = fixture();
  const authorization = sign(
    data.curatorKey,
    createNip29PublisherAuthorizationTemplate(
      "demo",
      data.publisher,
      "authorized",
      1_699_999_999,
    ),
  );
  const manifest = {
    schema: "lapis.registry.nip29-release/2" as const,
    plugin: data.plugin,
    release: {
      ...data.releaseContent,
      schema: "lapis.registry.release/2" as const,
      version: "2.0.0",
      releaseSequence: "1",
      previousReleaseEventId: data.release.id,
    },
  };
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
  const release = sign(
    data.publisherKey,
    createNip29ReleaseMessageTemplate(
      "demo",
      {
        url: "https://relay.example/manifest-2.json",
        mimeType: "application/json",
        sha256: sha(manifestBytes),
        size: manifestBytes.byteLength,
      },
      1_700_000_100,
      "Demo 2.0.0",
    ),
  );
  const approval = sign(
    data.curatorKey,
    createNip29CuratorDecisionTemplate(release.id, "approved", 1_700_000_101),
  );
  const headOne = sign(
    data.curatorKey,
    createNip29RegistryHeadTemplate(
      {
        schema: "lapis.registry.plugin-head/1",
        pluginId: "demo",
        authorityEpoch: "epoch-1",
        headRevision: "1",
        activeReleaseEventId: data.release.id,
        releases: [
          {
            releaseEventId: data.release.id,
            manifestSha256: sha(data.manifestBytes),
            version: "1.0.0",
            releaseSequence: "0",
            state: "approved",
            decisionEventId: data.approval.id,
          },
        ],
        issuedAt: new Date(1_700_000_102_000).toISOString(),
        validUntil: new Date(1_702_592_102_000).toISOString(),
      },
      1_700_000_102,
    ),
  );
  const headTwo = sign(
    data.curatorKey,
    createNip29RegistryHeadTemplate(
      {
        schema: "lapis.registry.plugin-head/1",
        pluginId: "demo",
        authorityEpoch: "epoch-1",
        headRevision: "2",
        previousHeadEventId: headOne.id,
        activeReleaseEventId: release.id,
        releases: [
          {
            releaseEventId: data.release.id,
            manifestSha256: sha(data.manifestBytes),
            version: "1.0.0",
            state: "approved",
            decisionEventId: data.approval.id,
          },
          {
            releaseEventId: release.id,
            manifestSha256: sha(manifestBytes),
            version: "2.0.0",
            releaseSequence: "1",
            state: "approved",
            decisionEventId: approval.id,
          },
        ],
        issuedAt: new Date(1_700_000_103_000).toISOString(),
        validUntil: new Date(1_702_592_103_000).toISOString(),
      },
      1_700_000_103,
    ),
  );
  return {
    ...data,
    authorization,
    manifestTwoBytes: manifestBytes,
    releaseTwo: release,
    approvalTwo: approval,
    headOne,
    headTwo,
  };
}

describe("NIP-29 registry catalog data source", () => {
  it("projects trusted relay events and lazily verifies Blossom resources", async () => {
    const data = fixture();
    const factory = createInMemoryRelayFactory({
      events: [data.release, data.approval],
      authentication: { read: true },
    });
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(input.toString());
      if (url.pathname.endsWith(sha(data.manifestBytes))) {
        return new Response(data.manifestBytes);
      }
      if (url.pathname.endsWith(data.image.sha256)) {
        return new Response(data.imageBytes);
      }
      if (url.pathname.endsWith(data.markdown.sha256)) {
        return new Response(data.markdownBytes);
      }
      return new Response("missing", { status: 404 });
    });
    const source = createNip29RegistryCatalogDataSource({
      relays: ["wss://relay.example"],
      authorities: {
        curatorPubkeys: new Set([data.curator]),
        publisherPubkeysByPlugin: new Map([
          ["demo", new Set([data.publisher])],
        ]),
      },
      relayFactory: factory,
      blossomUrl: "https://blossom.example/base/",
      snapshotStore: createMemoryRegistrySnapshotStore(),
      fetch,
      now: () => new Date("2026-09-03T12:00:00.000Z"),
      liveBatchMs: 0,
    });

    await expect(source.loadIndex()).resolves.toMatchObject({
      plugins: [{ id: "demo", latestVersion: "1.0.0" }],
    });
    const entry = (await source.loadIndex()).plugins[0]!;
    const detail = await source.loadPluginDetail(entry);
    await expect(source.loadMarkdown(data.markdown)).resolves.toBe(
      "# Verified overview",
    );
    const blob = await source.loadImage(data.image);

    expect(detail.id).toBe("demo");
    expect(detail.versions["1.0.0"]?.bundle).toMatchObject({
      url: `https://blossom.example/base/${"b".repeat(64)}`,
    });
    expect(blob.type).toBe("image/webp");
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(data.imageBytes);
    expect(
      fetch.mock.calls.map(([input]) => new URL(input.toString()).href),
    ).toContain(`https://blossom.example/base/${data.image.sha256}`);
    expect(
      fetch.mock.calls.map(([input]) => new URL(input.toString()).origin),
    ).not.toContain("https://assets.example");
    expect(source.getStatus()).toMatchObject({
      phase: "ready",
      fresh: true,
      installReady: true,
      origin: "relay",
    });
    await expect(
      source.loadReleaseInspection?.(data.release.id),
    ).resolves.toMatchObject({
      eventId: data.release.id,
      pluginId: "demo",
      version: "1.0.0",
      state: "approved",
      preview: { entry: { id: "demo" }, detail: { id: "demo" } },
    });
    await expect(
      source.loadReleaseInspection?.("f".repeat(64)),
    ).resolves.toBeUndefined();
    await expect(source.loadReleaseProof("demo", "1.0.0")).rejects.toThrow(
      "portable proof requires a signed publisher authorization",
    );
    source.dispose();
  });

  it("discovers curator-signed publisher authorization without a static publisher map", async () => {
    const data = fixture();
    const authorization = sign(
      data.curatorKey,
      createNip29PublisherAuthorizationTemplate(
        "demo",
        data.publisher,
        "authorized",
        1_699_999_999,
      ),
    );
    const source = createNip29RegistryCatalogDataSource({
      relays: ["wss://relay.example"],
      authorities: {
        curatorPubkeys: new Set([data.curator]),
        publisherPubkeysByPlugin: new Map(),
      },
      relayFactory: createInMemoryRelayFactory({
        events: [authorization, data.release, data.approval],
      }),
      snapshotStore: createMemoryRegistrySnapshotStore(),
      fetch: async () => new Response(data.manifestBytes),
    });

    await expect(source.loadIndex()).resolves.toMatchObject({
      plugins: [{ id: "demo" }],
    });
    expect(source.getStatus()).toMatchObject({
      fresh: true,
      installReady: true,
    });
    await expect(source.loadReleaseProof("demo", "1.0.0")).resolves.toEqual({
      schema: "lapis.plugin.release-proof/1",
      authorizationEvent: authorization,
      releaseEvent: data.release,
      decisionEvent: data.approval,
      manifest: {
        sha256: sha(data.manifestBytes),
        size: data.manifestBytes.byteLength,
        content: new TextDecoder().decode(data.manifestBytes),
      },
    });
    source.dispose();
  });

  it("loads pinned historical snapshots and v2 proofs from a fresh signed head", async () => {
    const data = sequencedFixture();
    const factory = createInMemoryRelayFactory({
      events: [
        data.authorization,
        data.release,
        data.approval,
        data.releaseTwo,
        data.approvalTwo,
        data.headOne,
        data.headTwo,
      ],
    });
    const source = createNip29RegistryCatalogDataSource({
      relays: ["wss://relay.example"],
      authorities: {
        curatorPubkeys: new Set([data.curator]),
        publisherPubkeysByPlugin: new Map(),
        authorityEpoch: "epoch-1",
      },
      relayFactory: factory,
      snapshotStore: createMemoryRegistrySnapshotStore(),
      fetch: async (input) => {
        const path = new URL(input.toString()).pathname;
        return new Response(
          path.endsWith(sha(data.manifestTwoBytes))
            ? data.manifestTwoBytes
            : data.manifestBytes,
        );
      },
      now: () => new Date(1_700_000_200_000),
    });

    await expect(source.loadIndex()).resolves.toMatchObject({
      plugins: [{ id: "demo", latestVersion: "2.0.0" }],
    });
    expect(source.getStatus()).toMatchObject({
      trust: "fresh",
      installReady: true,
    });
    await expect(
      source.loadPluginVersionDetail?.("demo", "1.0.0"),
    ).resolves.toMatchObject({
      entry: { id: "demo", latestVersion: "1.0.0" },
      release: { version: "1.0.0" },
      releaseEvent: { id: data.release.id },
      latestStatus: "approved",
    });
    await expect(
      source.loadPluginVersionDetail?.("demo", "2.0.0"),
    ).resolves.toMatchObject({
      release: { version: "2.0.0", releaseSequence: "1" },
      releaseEvent: { id: data.releaseTwo.id },
      releaseSequence: "1",
      latestStatus: "approved",
    });
    await expect(
      source.loadReleaseProof("demo", "2.0.0"),
    ).resolves.toMatchObject({
      schema: "lapis.plugin.release-proof/2",
      releaseEvent: { id: data.releaseTwo.id },
      decisionEvent: { id: data.approvalTwo.id },
      headEvent: { id: data.headTwo.id },
    });
    await expect(
      source.loadPluginVersionDetail?.("demo", "3.0.0"),
    ).rejects.toThrow("accepted release is unavailable");
    source.dispose();
  });

  it("retains its trusted high-water checkpoint when a relay rolls back", async () => {
    const data = sequencedFixture();
    const store = createMemoryRegistrySnapshotStore();
    const shared = {
      relays: ["wss://relay.example"],
      authorities: {
        curatorPubkeys: new Set([data.curator]),
        publisherPubkeysByPlugin: new Map<string, Set<string>>(),
        authorityEpoch: "epoch-1",
      },
      snapshotStore: store,
      fetch: async (input: RequestInfo | URL) => {
        const path = new URL(input.toString()).pathname;
        return new Response(
          path.endsWith(sha(data.manifestTwoBytes))
            ? data.manifestTwoBytes
            : data.manifestBytes,
        );
      },
      now: () => new Date(1_700_000_200_000),
    } as const;
    const current = createNip29RegistryCatalogDataSource({
      ...shared,
      relayFactory: createInMemoryRelayFactory({
        events: [
          data.authorization,
          data.release,
          data.approval,
          data.releaseTwo,
          data.approvalTwo,
          data.headOne,
          data.headTwo,
        ],
      }),
    });
    await current.loadIndex();
    current.dispose();

    const rolledBack = createNip29RegistryCatalogDataSource({
      ...shared,
      relayFactory: createInMemoryRelayFactory({
        events: [data.authorization, data.release, data.approval, data.headOne],
      }),
    });
    await rolledBack.loadIndex();
    await rolledBack.refresh();
    expect(rolledBack.getStatus()).toMatchObject({
      phase: "degraded",
      trust: "rollback",
      installReady: false,
    });
    await rolledBack.resetTrustHistory?.("demo");
    await rolledBack.refresh();
    expect(rolledBack.getStatus()).toMatchObject({
      trust: "fresh",
      installReady: true,
    });
    rolledBack.dispose();
  });

  it("intersects the pinned curator set with relay roles before managing releases", async () => {
    const data = sequencedFixture();
    const roleSnapshot = sign(generateSecretKey(), {
      kind: 39_002,
      created_at: 1_700_000_104,
      content: "",
      tags: [
        ["d", lapisGroupId(LAPIS_GROUPS.pluginReleases)],
        ["p", data.curator, "registry-curator"],
      ],
    });
    const factory = createInMemoryRelayFactory({
      events: [
        data.authorization,
        data.release,
        data.approval,
        data.releaseTwo,
        data.approvalTwo,
        data.headOne,
        data.headTwo,
        roleSnapshot,
      ],
    });
    const source = createNip29RegistryCatalogDataSource({
      relays: ["wss://relay.example"],
      authorities: {
        curatorPubkeys: new Set([data.curator]),
        publisherPubkeysByPlugin: new Map(),
        authorityEpoch: "epoch-1",
      },
      relayFactory: factory,
      snapshotStore: createMemoryRegistrySnapshotStore(),
      fetch: async (input) => {
        const path = new URL(input.toString()).pathname;
        return new Response(
          path.endsWith(sha(data.manifestTwoBytes))
            ? data.manifestTwoBytes
            : data.manifestBytes,
        );
      },
      now: () => new Date(1_700_000_200_000),
      liveBatchMs: 0,
    });
    await source.loadIndex();

    const curatorSigner = new SecretKeyRegistrySigner(data.curatorKey);
    const publisherSigner = new SecretKeyRegistrySigner(data.publisherKey);
    const unrelatedSigner = new SecretKeyRegistrySigner(generateSecretKey());
    await expect(
      source.loadReleaseManagementCapabilities?.(
        data.releaseTwo.id,
        curatorSigner,
      ),
    ).resolves.toMatchObject({ actions: ["revoke"], trust: "fresh" });
    await expect(
      source.loadReleaseManagementCapabilities?.(
        data.releaseTwo.id,
        publisherSigner,
      ),
    ).resolves.toMatchObject({ actions: ["withdraw"] });
    await expect(
      source.loadReleaseManagementCapabilities?.(
        data.releaseTwo.id,
        unrelatedSigner,
      ),
    ).resolves.toMatchObject({ actions: [] });

    await expect(
      source.performReleaseAction?.(
        {
          action: "revoke",
          eventId: data.releaseTwo.id,
          expectedManifestSha256: sha(data.manifestTwoBytes),
          expectedHeadEventId: data.headTwo.id,
        },
        curatorSigner,
      ),
    ).resolves.toMatchObject({
      action: "revoke",
      eventId: data.releaseTwo.id,
      decisionEventId: expect.stringMatching(/^[0-9a-f]{64}$/u),
      headEventId: expect.stringMatching(/^[0-9a-f]{64}$/u),
    });
    await expect(source.loadIndex()).resolves.toMatchObject({
      plugins: [{ id: "demo", latestVersion: "1.0.0" }],
    });
    source.dispose();
  });

  it("blocks a head that is not present on the configured install quorum", async () => {
    const data = sequencedFixture();
    const common = [
      data.authorization,
      data.release,
      data.approval,
      data.headOne,
    ];
    const source = createNip29RegistryCatalogDataSource({
      relays: ["wss://current.example", "wss://lagging.example"],
      authorities: {
        curatorPubkeys: new Set([data.curator]),
        publisherPubkeysByPlugin: new Map(),
        authorityEpoch: "epoch-1",
      },
      relayFactory: createInMemoryRelayFactory({
        relayOptions: (url) => ({
          events: url.includes("current")
            ? [...common, data.releaseTwo, data.approvalTwo, data.headTwo]
            : common,
        }),
      }),
      installQuorum: 2,
      snapshotStore: createMemoryRegistrySnapshotStore(),
      fetch: async (input) => {
        const path = new URL(input.toString()).pathname;
        return new Response(
          path.endsWith(sha(data.manifestTwoBytes))
            ? data.manifestTwoBytes
            : data.manifestBytes,
        );
      },
      now: () => new Date(1_700_000_200_000),
    });

    await source.loadIndex();
    expect(source.getStatus()).toMatchObject({
      phase: "degraded",
      trust: "rollback",
      installReady: false,
      message: expect.stringContaining("install quorum"),
    });
    await expect(source.loadReleaseProof("demo", "2.0.0")).rejects.toThrow(
      "quorum",
    );
    source.dispose();
  });

  it("fails closed on two curator-signed heads at one revision", async () => {
    const data = sequencedFixture();
    const conflictingHead = sign(
      data.curatorKey,
      createNip29RegistryHeadTemplate(
        {
          ...JSON.parse(data.headTwo.content),
          validUntil: new Date(1_702_592_102_000).toISOString(),
        },
        data.headTwo.created_at,
      ),
    );
    const source = createNip29RegistryCatalogDataSource({
      relays: ["wss://relay.example"],
      authorities: {
        curatorPubkeys: new Set([data.curator]),
        publisherPubkeysByPlugin: new Map(),
        authorityEpoch: "epoch-1",
      },
      relayFactory: createInMemoryRelayFactory({
        events: [
          data.authorization,
          data.release,
          data.approval,
          data.releaseTwo,
          data.approvalTwo,
          data.headOne,
          data.headTwo,
          conflictingHead,
        ],
      }),
      snapshotStore: createMemoryRegistrySnapshotStore(),
      fetch: async (input) => {
        const path = new URL(input.toString()).pathname;
        return new Response(
          path.endsWith(sha(data.manifestTwoBytes))
            ? data.manifestTwoBytes
            : data.manifestBytes,
        );
      },
      now: () => new Date(1_700_000_200_000),
    });

    await source.loadIndex();
    expect(source.getStatus()).toMatchObject({
      phase: "degraded",
      trust: "equivocation",
      installReady: false,
    });
    source.dispose();
  });

  it("does not fetch manifests for untrusted release publishers", async () => {
    const data = fixture();
    const untrustedKey = generateSecretKey();
    const untrustedRelease = sign(
      untrustedKey,
      createNip29ReleaseMessageTemplate(
        "demo",
        {
          url: "https://relay.example/manifest.json",
          mimeType: "application/json",
          sha256: sha(data.manifestBytes),
          size: data.manifestBytes.byteLength,
        },
        1_700_000_002,
        "Untrusted Demo 1.0.0",
      ),
    );
    const fetch = vi.fn(async () => new Response(data.manifestBytes));
    const source = createNip29RegistryCatalogDataSource({
      relays: ["wss://relay.example"],
      authorities: {
        curatorPubkeys: new Set([data.curator]),
        publisherPubkeysByPlugin: new Map([
          ["demo", new Set([data.publisher])],
        ]),
      },
      relayFactory: createInMemoryRelayFactory({ events: [untrustedRelease] }),
      snapshotStore: createMemoryRegistrySnapshotStore(),
      fetch,
    });

    await expect(source.loadIndex()).resolves.toMatchObject({ plugins: [] });
    const inspected = await source.loadReleaseInspection?.(untrustedRelease.id);
    expect(inspected).toMatchObject({ state: "untrusted" });
    expect(inspected?.preview).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
    source.dispose();
  });

  it.each([
    ["memory", () => createMemoryRegistrySnapshotStore()],
    [
      "IndexedDB",
      () =>
        createIndexedDbRegistrySnapshotStore({
          databaseName: `lapis-registry-source-test-${crypto.randomUUID()}`,
        }),
    ],
  ] as const)(
    "restores a verified %s snapshot while offline",
    async (_mode, createStore) => {
      const data = fixture();
      const store = createStore();
      const onlineFactory = createInMemoryRelayFactory({
        events: [data.release, data.approval],
      });
      const fetch = async (input: RequestInfo | URL) =>
        new URL(input.toString()).pathname.endsWith(sha(data.manifestBytes))
          ? new Response(data.manifestBytes)
          : new Response(data.imageBytes);
      const options = {
        relays: ["wss://relay.example"],
        authorities: {
          curatorPubkeys: new Set([data.curator]),
          publisherPubkeysByPlugin: new Map([
            ["demo", new Set([data.publisher])],
          ]),
        },
        snapshotStore: store,
        fetch,
        now: () => new Date("2026-09-03T12:00:00.000Z"),
      } as const;
      const online = createNip29RegistryCatalogDataSource({
        ...options,
        relayFactory: onlineFactory,
      });
      await online.loadIndex();
      await online.loadImage(data.image);
      online.dispose();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const offlineFactory = createInMemoryRelayFactory({
        faults: { disconnected: true },
      });
      const offline = createNip29RegistryCatalogDataSource({
        ...options,
        relayFactory: offlineFactory,
      });
      await expect(offline.loadIndex()).resolves.toMatchObject({
        plugins: [{ id: "demo" }],
      });
      expect(offline.getStatus()).toMatchObject({ fresh: false });
      await expect(offline.loadImage(data.image)).resolves.toBeInstanceOf(Blob);
      offline.dispose();
    },
  );

  it("applies a trusted live revocation without reloading a static index", async () => {
    const data = fixture();
    const factory = createInMemoryRelayFactory({
      events: [data.release, data.approval],
    });
    const source = createNip29RegistryCatalogDataSource({
      relays: ["wss://relay.example"],
      authorities: {
        curatorPubkeys: new Set([data.curator]),
        publisherPubkeysByPlugin: new Map([
          ["demo", new Set([data.publisher])],
        ]),
      },
      relayFactory: factory,
      snapshotStore: createMemoryRegistrySnapshotStore(),
      fetch: async () => new Response(data.manifestBytes),
      now: () => new Date("2026-09-03T12:00:00.000Z"),
      liveBatchMs: 0,
    });
    await source.loadIndex();
    const revision = new Promise<void>((resolve) => {
      const unsubscribe = source.subscribe((event) => {
        if (event.type === "revision" && event.status.registryRoot) {
          unsubscribe();
          resolve();
        }
      });
    });
    factory
      .relay("wss://relay.example/")
      .inject(
        sign(
          data.curatorKey,
          createNip29CuratorDecisionTemplate(
            data.release.id,
            "revoked",
            1_700_000_002,
          ),
        ),
      );
    await revision;

    expect((await source.loadIndex()).plugins).toEqual([]);
    source.dispose();
  });

  it("fails closed when a resource does not match signed metadata", async () => {
    const data = fixture();
    const factory = createInMemoryRelayFactory({
      events: [data.release, data.approval],
    });
    const source = createNip29RegistryCatalogDataSource({
      relays: ["wss://relay.example"],
      authorities: {
        curatorPubkeys: new Set([data.curator]),
        publisherPubkeysByPlugin: new Map([
          ["demo", new Set([data.publisher])],
        ]),
      },
      relayFactory: factory,
      snapshotStore: createMemoryRegistrySnapshotStore(),
      fetch: async (input) =>
        new URL(input.toString()).pathname.endsWith(sha(data.manifestBytes))
          ? new Response(data.manifestBytes)
          : new Response("tampered"),
    });
    await source.loadIndex();
    await expect(source.loadImage(data.image)).rejects.toThrow(/verification/u);
    await expect(source.loadMarkdown(data.markdown)).rejects.toThrow(
      /verification/u,
    );
    source.dispose();
  });

  it("marks one complete relay response fresh and reports partial failures", async () => {
    const data = fixture();
    const factory = createInMemoryRelayFactory({
      relayOptions: (url) =>
        url.includes("healthy")
          ? { events: [data.release, data.approval] }
          : { faults: { disconnected: true } },
    });
    const source = createNip29RegistryCatalogDataSource({
      relays: ["wss://healthy.example", "wss://offline.example"],
      authorities: {
        curatorPubkeys: new Set([data.curator]),
        publisherPubkeysByPlugin: new Map([
          ["demo", new Set([data.publisher])],
        ]),
      },
      relayFactory: factory,
      snapshotStore: createMemoryRegistrySnapshotStore(),
      fetch: async () => new Response(data.manifestBytes),
    });

    await expect(source.loadIndex()).resolves.toMatchObject({
      plugins: [{ id: "demo" }],
    });
    expect(source.getStatus()).toMatchObject({
      fresh: true,
      installReady: false,
      message: "Some configured registry relays were unavailable",
      relays: [
        { relay: "wss://healthy.example/" },
        { relay: "wss://offline.example/", error: expect.any(String) },
      ],
    });
    await expect(source.loadReleaseProof("demo", "1.0.0")).rejects.toThrow(
      "Registry relay quorum is required",
    );
    source.dispose();
  });

  it("loads resources from relay-owned Blossom by hash without using signed external sources", async () => {
    const data = fixture();
    const factory = createInMemoryRelayFactory({
      events: [data.release, data.approval],
    });
    const requested: string[] = [];
    const source = createNip29RegistryCatalogDataSource({
      relays: ["wss://relay.example"],
      authorities: {
        curatorPubkeys: new Set([data.curator]),
        publisherPubkeysByPlugin: new Map([
          ["demo", new Set([data.publisher])],
        ]),
      },
      relayFactory: factory,
      blossomUrl: "https://blossom.example/",
      snapshotStore: createMemoryRegistrySnapshotStore(),
      fetch: async (input) => {
        const url = new URL(input.toString());
        requested.push(url.href);
        if (url.pathname.endsWith(sha(data.manifestBytes))) {
          return new Response(data.manifestBytes);
        }
        return new Response(data.imageBytes);
      },
    });
    await source.loadIndex();

    await expect(source.loadImage(data.image)).resolves.toBeInstanceOf(Blob);
    expect(requested.at(-1)).toBe(
      `https://blossom.example/${data.image.sha256}`,
    );
    expect(requested).not.toContain(data.image.sourceUrl);
    source.dispose();
  });

  it("isolates restored snapshots when the trusted authority fingerprint changes", async () => {
    const data = fixture();
    const store = createMemoryRegistrySnapshotStore();
    const online = createNip29RegistryCatalogDataSource({
      relays: ["wss://relay.example"],
      authorities: {
        curatorPubkeys: new Set([data.curator]),
        publisherPubkeysByPlugin: new Map([
          ["demo", new Set([data.publisher])],
        ]),
      },
      relayFactory: createInMemoryRelayFactory({
        events: [data.release, data.approval],
      }),
      snapshotStore: store,
      fetch: async () => new Response(data.manifestBytes),
    });
    await online.loadIndex();
    online.dispose();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const offline = createNip29RegistryCatalogDataSource({
      relays: ["wss://relay.example"],
      authorities: {
        curatorPubkeys: new Set([getPublicKey(generateSecretKey())]),
        publisherPubkeysByPlugin: new Map([
          ["demo", new Set([data.publisher])],
        ]),
      },
      relayFactory: createInMemoryRelayFactory({
        faults: { disconnected: true },
      }),
      snapshotStore: store,
      fetch: async () => new Response(data.manifestBytes),
    });

    await expect(offline.loadIndex()).rejects.toThrow(
      "No configured relay answered",
    );
    expect(offline.getStatus()).toMatchObject({ phase: "error", fresh: false });
    offline.dispose();
  });

  it("retains the previous revision when a live manifest cannot be hydrated", async () => {
    const data = fixture();
    const factory = createInMemoryRelayFactory({
      events: [data.release, data.approval],
    });
    const source = createNip29RegistryCatalogDataSource({
      relays: ["wss://relay.example"],
      authorities: {
        curatorPubkeys: new Set([data.curator]),
        publisherPubkeysByPlugin: new Map([
          ["demo", new Set([data.publisher])],
        ]),
      },
      relayFactory: factory,
      snapshotStore: createMemoryRegistrySnapshotStore(),
      fetch: async (input) =>
        new URL(input.toString()).pathname.endsWith(sha(data.manifestBytes))
          ? new Response(data.manifestBytes)
          : new Response("missing", { status: 404 }),
      liveBatchMs: 0,
    });
    const previous = await source.loadIndex();
    const unavailable = new TextEncoder().encode("missing");
    factory.relay("wss://relay.example/").inject(
      sign(
        data.publisherKey,
        createNip29ReleaseMessageTemplate(
          "demo",
          {
            url: "https://relay.example/unavailable.json",
            mimeType: "application/json",
            sha256: sha(unavailable),
            size: unavailable.byteLength,
          },
          1_700_000_003,
          "Demo 2.0.0",
        ),
      ),
    );

    await vi.waitFor(() =>
      expect(source.getStatus()).toMatchObject({
        phase: "degraded",
        fresh: false,
        installReady: false,
      }),
    );
    expect(await source.loadIndex()).toEqual(previous);
    source.dispose();
  });

  it("validates transport URLs and supports aborting a catalog load", async () => {
    const data = fixture();
    const factory = createInMemoryRelayFactory({
      events: [data.release, data.approval],
      faults: { latencyMs: 20 },
    });
    const baseOptions = {
      relays: ["wss://relay.example"],
      authorities: {
        curatorPubkeys: new Set([data.curator]),
        publisherPubkeysByPlugin: new Map([
          ["demo", new Set([data.publisher])],
        ]),
      },
      relayFactory: factory,
      snapshotStore: createMemoryRegistrySnapshotStore(),
      fetch: async () => new Response(data.manifestBytes),
    } as const;

    expect(() =>
      createNip29RegistryCatalogDataSource({
        ...baseOptions,
        blossomUrl: "https://user@example.com/",
      }),
    ).toThrow("without credentials");
    expect(() =>
      createNip29RegistryCatalogDataSource({
        ...baseOptions,
        relays: ["https://relay.example"],
      }),
    ).toThrow("WS(S)");

    const source = createNip29RegistryCatalogDataSource(baseOptions);
    const controller = new AbortController();
    const load = source.loadIndex({ signal: controller.signal });
    controller.abort(new DOMException("Cancelled", "AbortError"));
    await expect(load).rejects.toMatchObject({ name: "AbortError" });
    await expect(source.loadIndex()).resolves.toMatchObject({
      plugins: [{ id: "demo" }],
    });
    source.dispose();
    await expect(source.refresh()).rejects.toThrow("disposed");
  });
});
