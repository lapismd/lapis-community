import { describe, expect, it, vi } from "vitest";

import { RegistryCatalogSession } from "./session.js";
import type {
  RegistryCatalogDataSource,
  RegistryCatalogDetail,
  RegistryCatalogEntry,
} from "./model.js";

const entry: RegistryCatalogEntry = {
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
  badges: [],
  owner: { name: "Lapis Notes", verified: true },
  detail: "plugins/ai.json",
};

const detail: RegistryCatalogDetail = {
  ...entry,
  schemaVersion: 1,
  content: {
    overview: {
      url: "content/ai.md",
      sourceUrl: "https://example.com/ai.md",
      sha256: "0".repeat(64),
      size: 4,
      mediaType: "text/markdown",
    },
  },
  versions: {
    "1.0.0": {
      version: "1.0.0",
      minAppVersion: "0.1.0",
      releasedAt: "2026-09-03T00:00:00.000Z",
      platforms: ["web"],
      bundle: { url: "ai.lapis-plugin", sha256: "0".repeat(64), size: 1 },
    },
  },
};

describe("RegistryCatalogSession", () => {
  it("loads each detail and its Markdown once per component session", async () => {
    const loadPluginDetail = vi.fn(async () => detail);
    const loadMarkdown = vi.fn(async () => "# Overview");
    const source: RegistryCatalogDataSource = {
      loadIndex: vi.fn(),
      loadRuntime: vi.fn(),
      loadPluginDetail,
      loadMarkdown,
    };
    const session = new RegistryCatalogSession(source);

    const first = await session.loadDetail(entry);
    const second = await session.loadDetail(entry);

    expect(second).toBe(first);
    expect(session.hasDetail("ai")).toBe(true);
    expect(loadPluginDetail).toHaveBeenCalledOnce();
    expect(loadMarkdown).toHaveBeenCalledOnce();
    expect(first.overviewHtml).toContain("<h1>Overview</h1>");
  });

  it("keeps catalog detail usable when optional Markdown fails", async () => {
    const source: RegistryCatalogDataSource = {
      loadIndex: vi.fn(),
      loadRuntime: vi.fn(),
      loadPluginDetail: vi.fn(async () => detail),
      loadMarkdown: vi.fn(async () => {
        throw new Error("offline");
      }),
    };

    const resolved = await new RegistryCatalogSession(source).loadDetail(entry);

    expect(resolved.detail).toBe(detail);
    expect(resolved.contentError).toContain("overview");
  });
});
