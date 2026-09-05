import "fake-indexeddb/auto";

import { createHash } from "node:crypto";

import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from "nostr-tools/pure";
import { describe, expect, it, vi } from "vitest";

import {
  createNip29CuratorDecisionTemplate,
  createNip29PublisherAuthorizationTemplate,
  createNip29ReleaseMessageTemplate,
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
    release,
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
      if (url.pathname === "/manifest.json") {
        return new Response(data.manifestBytes);
      }
      if (url.pathname.endsWith(".webp")) {
        return new Response(data.imageBytes);
      }
      if (url.pathname.endsWith("overview.md")) {
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
    expect(blob.type).toBe("image/webp");
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(data.imageBytes);
    expect(
      fetch.mock.calls.map(([input]) => new URL(input.toString()).href),
    ).toContain(
      `https://blossom.example/base/registry/assets/demo/${data.image.sha256}.webp`,
    );
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
        new URL(input.toString()).pathname === "/manifest.json"
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
        new URL(input.toString()).pathname === "/manifest.json"
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
    source.dispose();
  });

  it("falls back from Blossom to the signed image source and still verifies bytes", async () => {
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
        if (url.pathname === "/manifest.json") {
          return new Response(data.manifestBytes);
        }
        if (url.hostname === "blossom.example") {
          return new Response("unavailable", { status: 503 });
        }
        return new Response(data.imageBytes);
      },
    });
    await source.loadIndex();

    await expect(source.loadImage(data.image)).resolves.toBeInstanceOf(Blob);
    expect(requested.slice(-2)).toEqual([
      `https://blossom.example/registry/assets/demo/${data.image.sha256}.webp`,
      data.image.sourceUrl,
    ]);
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
        new URL(input.toString()).pathname === "/manifest.json"
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
