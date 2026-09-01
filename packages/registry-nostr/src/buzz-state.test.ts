import { createHash } from "node:crypto";

import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  verifyEvent,
} from "nostr-tools/pure";
import { describe, expect, it, vi } from "vitest";

import {
  createBuzzCuratorDecisionTemplate,
  createBuzzReleaseMessageTemplate,
} from "@lapismd/registry-protocol";
import type {
  NostrEvent,
  NostrEventTemplate,
  PluginDefinitionContent,
  ReleaseContent,
} from "@lapismd/registry-protocol";

import { loadBuzzRelayRegistryState } from "./buzz-state.js";
import type {
  RegistryRelay,
  RelayFilter,
  RelayPublishResult,
} from "./transport.js";

class FixtureRelay implements RegistryRelay {
  readonly url = "wss://relay.example";
  authenticated = false;

  constructor(readonly events: NostrEvent[]) {}

  async authenticate(): Promise<RelayPublishResult> {
    this.authenticated = true;
    return { accepted: true, message: "authenticated" };
  }

  async query(filter: RelayFilter): Promise<NostrEvent[]> {
    if (!this.authenticated) throw new Error("NIP-42 required");
    return this.events.filter((event) => filter.kinds?.includes(event.kind));
  }

  async publish(): Promise<RelayPublishResult> {
    return { accepted: true, message: "" };
  }

  close(): void {}
}

function sign(secret: Uint8Array, template: NostrEventTemplate): NostrEvent {
  return finalizeEvent(template, secret);
}

describe("loadBuzzRelayRegistryState", () => {
  it("NIP-42 authenticates, verifies the attached manifest, and builds V1 output", async () => {
    const publisherKey = generateSecretKey();
    const curatorKey = generateSecretKey();
    const publisher = getPublicKey(publisherKey);
    const curator = getPublicKey(curatorKey);
    const manifest: ReleaseContent = {
      schema: "lapis.registry.release/1",
      pluginId: "demo",
      version: "1.0.0",
      minAppVersion: "0.1.0",
      platforms: ["web"],
      releasedAt: "2026-09-01T10:00:00.000Z",
      artifact: {
        url: "https://downloads.example/demo.lapis-plugin",
        sha256: "b".repeat(64),
        size: 100,
      },
      metadata: {},
    };
    const bytes = new TextEncoder().encode(JSON.stringify(manifest));
    const manifestSha256 = createHash("sha256").update(bytes).digest("hex");
    const release = sign(
      publisherKey,
      createBuzzReleaseMessageTemplate(
        "demo",
        {
          url: "https://relay.example/media/manifest.json",
          mimeType: "application/json",
          sha256: manifestSha256,
          size: bytes.byteLength,
        },
        1_700_000_000,
        "Demo 1.0.0",
      ),
    );
    const approval = sign(
      curatorKey,
      createBuzzCuratorDecisionTemplate(release.id, "approved", 1_700_000_001),
    );
    const plugin: PluginDefinitionContent = {
      schema: "lapis.registry.plugin/1",
      pluginId: "demo",
      name: "Demo",
      description: "Fixture",
      channel: "official",
      status: "active",
      index: {},
      detail: {},
    };
    const relay = new FixtureRelay([release, approval]);
    let mediaAuthorization = "";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async function (
        this: typeof globalThis,
        _input,
        init,
      ) {
        expect(this).toBe(globalThis);
        mediaAuthorization =
          new Headers(init?.headers).get("Authorization") ?? "";
        return new Response(bytes, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

    const state = await loadBuzzRelayRegistryState({
      relays: [relay],
      catalog: [{ content: plugin }],
      authorities: {
        curatorPubkeys: new Set([curator]),
        publisherPubkeysByPlugin: new Map([["demo", new Set([publisher])]]),
      },
      generatedAt: "2026-09-01T11:00:00.000Z",
      authSigner: async (template) => sign(publisherKey, template),
    }).finally(() => fetchMock.mockRestore());

    expect(relay.authenticated).toBe(true);
    expect(state.registry.plugins[0]?.latestVersion).toBe("1.0.0");
    expect(state.projection.index.plugins).toMatchObject([
      { id: "demo", latestVersion: "1.0.0" },
    ]);
    expect(state.sources).toEqual([
      {
        relay: relay.url,
        eventIds: [approval.id, release.id].toSorted(),
      },
    ]);
    const mediaAuth = JSON.parse(
      Buffer.from(
        mediaAuthorization.slice("Nostr ".length),
        "base64url",
      ).toString("utf8"),
    ) as NostrEvent;
    expect(verifyEvent(mediaAuth)).toBe(true);
    expect(mediaAuth.kind).toBe(24_242);
    expect(mediaAuth.pubkey).toBe(publisher);
    expect(mediaAuth.tags).toEqual(
      expect.arrayContaining([
        ["t", "get"],
        ["server", "relay.example"],
      ]),
    );
  });

  it("rejects a manifest whose bytes do not match its NIP-92 hash", async () => {
    const publisherKey = generateSecretKey();
    const release = sign(
      publisherKey,
      createBuzzReleaseMessageTemplate(
        "demo",
        {
          url: "https://relay.example/media/manifest.json",
          mimeType: "application/json",
          sha256: "a".repeat(64),
          size: 2,
        },
        1,
        "Demo",
      ),
    );
    const relay = new FixtureRelay([release]);
    await expect(
      loadBuzzRelayRegistryState({
        relays: [relay],
        catalog: [],
        authorities: {
          curatorPubkeys: new Set(),
          publisherPubkeysByPlugin: new Map(),
        },
        generatedAt: "2026-09-01T11:00:00.000Z",
        authSigner: async (template) => sign(publisherKey, template),
        fetch: async () => new Response("{}", { status: 200 }),
      }),
    ).rejects.toThrow("failed SHA-256 verification");
  });
});
