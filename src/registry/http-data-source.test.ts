import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { createHttpRegistryCatalogDataSource } from "./http-data-source.js";
import type {
  RegistryCatalogEntry,
  RegistryImageReference,
  RegistryMarkdownReference,
} from "./model.js";

function image(url: string): RegistryImageReference {
  return {
    url,
    sourceUrl: "https://source.example/assets/image.webp",
    sha256: "b".repeat(64),
    size: 123,
    mediaType: "image/webp",
    width: 1200,
    height: 800,
  };
}

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
  appearance: {
    icon: "sparkles",
    accent: "#8b5cf6",
    logo: { ...image("/registry/assets/ai/logo.webp"), alt: "AI logo" },
  },
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
    expect((await source.loadIndex()).plugins[0]?.appearance?.logo?.url).toBe(
      "https://community.example/registry/assets/ai/logo.webp",
    );
    expect((await source.loadRuntime())?.relays).toEqual([
      "wss://relay.example",
    ]);
    expect((await source.loadPluginDetail(plugin)).latestVersion).toBe("1.0.0");
  });

  it("rebases every projected image location and preserves signed metadata", async () => {
    const variants = {
      preview: image("/registry/assets/ai/preview.webp"),
      full: image("assets/ai/full.webp"),
      light: image("/registry/assets/ai/light.webp"),
      dark: image("/registry/assets/ai/dark.webp"),
    };
    const fetcher = vi.fn<typeof fetch>(async () =>
      json({
        schemaVersion: 1,
        ...plugin,
        media: {
          banner: { alt: "Banner", images: variants },
          overview: { alt: "Overview", images: variants },
        },
        gallery: [{ id: "one", alt: "Screenshot", images: variants }],
        versions: {},
      }),
    );
    const source = createHttpRegistryCatalogDataSource({
      baseUrl: "https://community.example/registry/",
      fetch: fetcher,
    });

    const detail = await source.loadPluginDetail(plugin);
    expect(detail.appearance?.logo?.url).toBe(
      "https://community.example/registry/assets/ai/logo.webp",
    );
    for (const media of [
      detail.media?.banner,
      detail.media?.overview,
      detail.gallery?.[0],
    ]) {
      expect(media?.images.preview.url).toBe(
        "https://community.example/registry/assets/ai/preview.webp",
      );
      expect(media?.images.full.url).toBe(
        "https://community.example/registry/assets/ai/full.webp",
      );
      expect(media?.images.light.url).toBe(
        "https://community.example/registry/assets/ai/light.webp",
      );
      expect(media?.images.dark.url).toBe(
        "https://community.example/registry/assets/ai/dark.webp",
      );
      expect(media?.images.dark.sourceUrl).toBe(
        "https://source.example/assets/image.webp",
      );
      expect(media?.images.dark.sha256).toBe("b".repeat(64));
      expect(media?.images.dark.width).toBe(1200);
    }
  });

  it.each([
    ["https://images.example/logo.webp"],
    ["/outside/logo.webp"],
    ["../outside/logo.webp"],
  ])("rejects image URLs outside the configured registry root", async (url) => {
    const source = createHttpRegistryCatalogDataSource({
      baseUrl: "https://community.example/registry/",
      fetch: vi.fn<typeof fetch>(async () =>
        json({
          schemaVersion: 1,
          generatedAt: "2026-09-03T00:00:00.000Z",
          plugins: [
            {
              ...plugin,
              appearance: {
                ...plugin.appearance,
                logo: { ...plugin.appearance!.logo!, url },
              },
            },
          ],
        }),
      ),
    });
    await expect(source.loadIndex()).rejects.toThrow("must stay under");
  });

  it("rejects escaped image variants in plugin detail documents", async () => {
    const variants = {
      preview: image("/registry/assets/ai/preview.webp"),
      full: image("/registry/assets/ai/full.webp"),
      light: image("https://images.example/light.webp"),
      dark: image("/registry/assets/ai/dark.webp"),
    };
    const source = createHttpRegistryCatalogDataSource({
      baseUrl: "https://community.example/registry/",
      fetch: vi.fn<typeof fetch>(async () =>
        json({
          schemaVersion: 1,
          ...plugin,
          gallery: [{ id: "unsafe", alt: "Unsafe image", images: variants }],
          versions: {},
        }),
      ),
    });
    await expect(source.loadPluginDetail(plugin)).rejects.toThrow(
      "must stay under",
    );
  });

  it("derives safe detail paths from stable IDs and rejects mismatches", async () => {
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
        id: "../../../evil",
      }),
    ).rejects.toThrow("must stay under");
    await expect(source.loadPluginDetail({ id: plugin.id })).rejects.toThrow(
      "does not match the index",
    );
  });

  it("returns null for missing runtime and HTML document fallbacks", async () => {
    const missing = createHttpRegistryCatalogDataSource({
      baseUrl: "https://community.example/registry/",
      fetch: vi.fn<typeof fetch>(
        async () => new Response(null, { status: 404 }),
      ),
    });
    await expect(missing.loadRuntime()).resolves.toBeNull();
    await expect(missing.loadIndex()).rejects.toThrow("failed with 404");

    const htmlFallback = createHttpRegistryCatalogDataSource({
      baseUrl: "https://community.example/registry/",
      fetch: vi.fn<typeof fetch>(
        async () =>
          new Response("<!doctype html><title>Registry</title>", {
            headers: { "content-type": "text/html; charset=utf-8" },
          }),
      ),
    });
    await expect(htmlFallback.loadRuntime()).resolves.toBeNull();
  });

  it("surfaces schema and non-JSON runtime failures", async () => {
    const invalid = createHttpRegistryCatalogDataSource({
      baseUrl: "https://community.example/registry/",
      fetch: vi.fn<typeof fetch>(async () => json({ schemaVersion: 2 })),
    });
    await expect(invalid.loadIndex()).rejects.toThrow();

    const text = createHttpRegistryCatalogDataSource({
      baseUrl: "https://community.example/registry/",
      fetch: vi.fn<typeof fetch>(
        async () =>
          new Response("not json", {
            headers: { "content-type": "text/plain" },
          }),
      ),
    });
    await expect(text.loadRuntime()).rejects.toThrow(
      "Registry runtime response was not JSON",
    );
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
