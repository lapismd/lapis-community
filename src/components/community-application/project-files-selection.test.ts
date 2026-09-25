import { describe, expect, it } from "vitest";

import type { ProjectForgeRepository } from "../../projects/index.js";
import {
  preferredProjectFilesRepository,
  projectFilesSurfaceLoadsTree,
} from "./project-files-selection.js";

const repository = (coordinate: string): ProjectForgeRepository => ({
  event: {
    id: coordinate,
    pubkey: "owner",
    created_at: 1,
    kind: 30_617,
    tags: [],
    content: "",
    sig: "sig",
  },
  address: {
    kind: 30_617,
    owner: "owner",
    identifier: coordinate,
    coordinate,
  },
  name: coordinate,
  description: "",
  channelId: coordinate,
  cloneUrls: [],
  webUrls: [],
  repositoryClass: "hosted",
});

describe("project files repository selection", () => {
  const lapis = repository("30617:owner:lapis-community");
  const probe = repository("30617:owner:jj-nostr-probe");

  it("uses the explicit files repository when present", () => {
    expect(
      preferredProjectFilesRepository([lapis, probe], {
        selectedCoordinate: lapis.address.coordinate,
        channelRepositoryCoordinate: probe.address.coordinate,
      }),
    ).toBe(lapis);
  });

  it("defaults inline channel sheets to the bound repository", () => {
    expect(
      preferredProjectFilesRepository([lapis, probe], {
        channelRepositoryCoordinate: probe.address.coordinate,
      }),
    ).toBe(probe);
  });

  it("falls back to the first available repository", () => {
    expect(
      preferredProjectFilesRepository([lapis, probe], {
        selectedCoordinate: "30617:owner:missing",
        channelRepositoryCoordinate: "30617:owner:also-missing",
      }),
    ).toBe(lapis);
  });
});

describe("project files tree loading", () => {
  it("loads inline channel files sheets without a durable files route revision", () => {
    expect(
      projectFilesSurfaceLoadsTree("files", {
        inlineProjectFilesSheetOpen: true,
      }),
    ).toBe(true);
  });

  it("waits for route revision on durable files routes", () => {
    expect(projectFilesSurfaceLoadsTree("files")).toBe(false);
    expect(
      projectFilesSurfaceLoadsTree("files", { filesRouteRevision: "main" }),
    ).toBe(true);
  });

  it("keeps overview and initial repository reads active", () => {
    expect(projectFilesSurfaceLoadsTree(undefined)).toBe(true);
    expect(projectFilesSurfaceLoadsTree("overview")).toBe(true);
    expect(projectFilesSurfaceLoadsTree("tasks")).toBe(false);
  });
});
