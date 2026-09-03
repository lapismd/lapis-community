import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { createHttpRegistryCatalogDataSource } from "./http-data-source.js";
import type {
  RegistryCatalogEntry,
  RegistryMarkdownReference,
} from "./model.js";

const plugin: RegistryCatalogEntry = {
  id: "ai",
  name: "AI",
  description: "Agent chat",
  author: "Lapis Notes",
  channel: "official",
  status: "active",
  latestVersion: "1.0.0",
  minAppVersion: "0.1.0",
  platforms: ["web"],
  categories: ["ai"],
  badges: ["official"],
  owner: { name: "Lapis Notes", verified: true },
  detail: "plugins/ai.json",
};

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("HTTP registry catalog data source", () => {
  it("loads and validates index, runtime, and matching detail documents", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(
        input instanceof Request ? input.url : input.toString(),
      );
      if (url.pathname.endsWith("index.json")) {
        return json({
          schemaVersion: 1,
          generatedAt: "2026-09-03T00:00:00.000Z",
          plugins: [plugin],
        });
      }
      if (url.pathname.endsWith("runtime.json")) {
        return json({
          schemaVersion: 1,
          backend: "nostr-nip29",
          registryRoot: "root",
          relays: ["wss://relay.example"],
          releaseGroupId: "group",
          curatorPubkeys: ["curator"],
          publisherPubkeys: ["publisher"],
        });
      }
      return json({
        schemaVersion: 1,
        ...plugin,
        versions: {
          "1.0.0": {
            version: "1.0.0",
            minAppVersion: "0.1.0",
            releasedAt: "2026-09-03T00:00:00.000Z",
            platforms: ["web"],
            bundle: { url: "bundles/ai", sha256: "a".repeat(64), size: 10 },
          },
        },
      });
    });
    const source = createHttpRegistryCatalogDataSource({
      baseUrl: "https://community.example/registry/",
      fetch: fetcher,
    });

    expect((await source.loadIndex()).plugins[0]?.id).toBe("ai");
    expect((await source.loadRuntime())?.relays).toEqual([
      "wss://relay.example",
    ]);
    expect((await source.loadPluginDetail(plugin)).latestVersion).toBe("1.0.0");
  });

  it("rejects unsafe paths and detail mismatches", async () => {
    const source = createHttpRegistryCatalogDataSource({
      baseUrl: "https://community.example/registry/",
      fetch: vi.fn<typeof fetch>(async () =>
        json({
          schemaVersion: 1,
          ...plugin,
          id: "other",
          versions: {},
        }),
      ),
    });
    await expect(
      source.loadPluginDetail({
        ...plugin,
        detail: "https://evil.example/plugin.json",
      }),
    ).rejects.toThrow("must stay under");
    await expect(source.loadPluginDetail(plugin)).rejects.toThrow(
      "does not match the index",
    );
  });

  it("returns null for missing runtime and surfaces HTTP and schema failures", async () => {
    const missing = createHttpRegistryCatalogDataSource({
      baseUrl: "https://community.example/registry/",
      fetch: vi.fn<typeof fetch>(
        async () => new Response(null, { status: 404 }),
      ),
    });
    await expect(missing.loadRuntime()).resolves.toBeNull();
    await expect(missing.loadIndex()).rejects.toThrow("failed with 404");

    const invalid = createHttpRegistryCatalogDataSource({
      baseUrl: "https://community.example/registry/",
      fetch: vi.fn<typeof fetch>(async () => json({ schemaVersion: 2 })),
    });
    await expect(invalid.loadIndex()).rejects.toThrow();
  });

  it("verifies mirrored Markdown size and SHA-256", async () => {
    const body = new TextEncoder().encode("# Verified\n");
    const reference: RegistryMarkdownReference = {
      url: "/registry/content/ai/overview.md",
      sourceUrl: "https://source.example/overview.md",
      mediaType: "text/markdown",
      size: body.byteLength,
      sha256: createHash("sha256").update(body).digest("hex"),
    };
    const source = createHttpRegistryCatalogDataSource({
      baseUrl: "https://community.example/registry/",
      fetch: vi.fn<typeof fetch>(async () => new Response(body)),
    });
    await expect(source.loadMarkdown(reference)).resolves.toBe("# Verified\n");
    await expect(
      source.loadMarkdown({ ...reference, sha256: "0".repeat(64) }),
    ).rejects.toThrow("hash does not match");
    await expect(
      source.loadMarkdown({ ...reference, size: body.byteLength + 1 }),
    ).rejects.toThrow("size does not match");
  });

  it("passes AbortSignal through to fetch", async () => {
    const controller = new AbortController();
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      expect(init?.signal).toBe(controller.signal);
      throw new DOMException("Aborted", "AbortError");
    });
    const source = createHttpRegistryCatalogDataSource({
      baseUrl: "https://community.example/registry/",
      fetch: fetcher,
    });
    controller.abort();
    await expect(
      source.loadIndex({ signal: controller.signal }),
    ).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});
