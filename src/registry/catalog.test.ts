import { describe, expect, it } from "vitest";

import {
  collectRegistryCategories,
  filterRegistryEntries,
  registryLandingSections,
  registryRouteFromDestination,
  registryRouteFromHash,
  registryRouteToDestination,
  registryRouteToHash,
  registryStatusLabel,
  relatedRegistryPlugins,
} from "./catalog.js";
import type {
  RegistryCatalogDetail,
  RegistryCatalogEntry,
  RegistryDirectoryState,
} from "./model.js";

function entry(
  id: string,
  overrides: Partial<RegistryCatalogEntry> = {},
): RegistryCatalogEntry {
  return {
    id,
    name: id === "ai" ? "AI" : id,
    description: `${id} description`,
    author: "Lapis Notes",
    channel: "official",
    status: "active",
    latestVersion: "1.0.0",
    minAppVersion: "0.1.0",
    platforms: ["web"],
    categories: ["productivity"],
    badges: ["official"],
    owner: { name: "Lapis Notes", verified: true },
    latestRelease: {
      releasedAt: "2026-09-01T00:00:00.000Z",
      bundleSize: 4096,
    },
    detail: `plugins/${id}.json`,
    ...overrides,
  };
}

const defaultState: RegistryDirectoryState = {
  query: "",
  categories: [],
  platforms: [],
  statuses: [],
  officialOnly: false,
  sort: "name",
  view: "grid",
};

describe("registry catalog helpers", () => {
  it("builds deterministic landing lanes and category counts", () => {
    const plugins = [
      entry("zeta", { categories: ["editor", "productivity"] }),
      entry("ai", {
        categories: ["ai", "productivity"],
        latestRelease: {
          releasedAt: "2026-09-02T00:00:00.000Z",
          bundleSize: 1024,
        },
      }),
      entry("pending", { status: "pending", categories: ["editor"] }),
    ];

    expect(
      registryLandingSections(plugins).featured.map(({ id }) => id),
    ).toEqual(["ai", "zeta"]);
    expect(collectRegistryCategories(plugins)).toEqual([
      { id: "ai", label: "AI", count: 1 },
      { id: "editor", label: "Editor", count: 2 },
      { id: "productivity", label: "Productivity", count: 2 },
    ]);
  });

  it("filters and sorts without depending on input order", () => {
    const plugins = [
      entry("slides", { name: "Slides", categories: ["presentation"] }),
      entry("ai", { platforms: ["electron"], categories: ["ai"] }),
      entry("community", { channel: "community", status: "deprecated" }),
    ];

    expect(
      filterRegistryEntries(plugins, {
        ...defaultState,
        query: "lapis notes",
        categories: ["ai"],
        platforms: ["electron"],
        officialOnly: true,
      }).map(({ id }) => id),
    ).toEqual(["ai"]);
    expect(
      filterRegistryEntries(plugins, {
        ...defaultState,
        sort: "status",
      }).map(({ id }) => id),
    ).toEqual(["ai", "slides", "community"]);
  });

  it("ranks related plugins by shared category then name", () => {
    const selected = {
      id: "ai",
      categories: ["ai", "productivity"],
    } as unknown as RegistryCatalogDetail;
    const plugins = [
      entry("notes", { categories: ["productivity"] }),
      entry("agents", { categories: ["ai", "productivity"] }),
      entry("unrelated", { categories: ["editor"] }),
      entry("ai", { categories: ["ai", "productivity"] }),
    ];
    expect(
      relatedRegistryPlugins(selected, plugins).map(({ id }) => id),
    ).toEqual(["agents", "notes"]);
  });

  it("maps all catalog statuses and application destinations", () => {
    expect(registryStatusLabel("disabled")).toBe("Unavailable");
    expect(
      registryRouteToDestination({ page: "plugin", pluginId: "lapis-ai" }),
    ).toBe("registry:plugin:lapis-ai");
    expect(
      registryRouteToDestination({
        page: "plugin",
        pluginId: "lapis-ai",
        view: "reviews",
      }),
    ).toBe("registry:plugin:lapis-ai:reviews");
    expect(
      registryRouteFromDestination("registry:plugin:lapis-ai:reviews"),
    ).toEqual({
      page: "plugin",
      pluginId: "lapis-ai",
      view: "reviews",
    });
    expect(registryRouteFromDestination("registry:plugins")).toEqual({
      page: "directory",
    });
    expect(
      registryRouteFromDestination("registry:plugin:not:valid"),
    ).toBeNull();
  });

  it("round-trips canonical version-pinned review and post hashes", () => {
    const route = {
      page: "plugin" as const,
      pluginId: "lapis-ai",
      version: "1.2.3-beta.1",
      view: "reviews" as const,
      postId: "a".repeat(64),
    };
    const hash =
      "#/registry/plugins/lapis-ai/versions/1.2.3-beta.1/reviews/posts/" +
      "a".repeat(64);
    expect(registryRouteToHash(route)).toBe(hash);
    expect(registryRouteFromHash(hash)).toEqual(route);
    expect(
      registryRouteFromHash("#/registry/plugins/lapis-ai/versions/no%20spaces"),
    ).toMatchObject({ version: "no spaces" });
  });
});
