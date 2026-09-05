import { describe, expect, it } from "vitest";

import {
  createNip29CuratorDecisionTemplate,
  createNip29ReleaseMessageTemplate,
  lapisGroupId,
  type Nip29RegistryAuthorities,
  type NostrEvent,
  type NostrEventTemplate,
} from "../protocol/index.js";
import {
  inspectRegistryReleaseCandidate,
  recognizeRegistryReleaseCandidate,
} from "./release-inspection.js";

const publisher = "1".repeat(64);
const curator = "2".repeat(64);
const manifestHash = "a".repeat(64);
const authorities: Nip29RegistryAuthorities = {
  curatorPubkeys: new Set([curator]),
  publisherPubkeysByPlugin: new Map([["demo", new Set([publisher])]]),
};

function event(
  template: NostrEventTemplate,
  id: string,
  pubkey = publisher,
): NostrEvent {
  return { ...template, id, pubkey, sig: "f".repeat(128) };
}

function releaseEvent(pubkey = publisher): NostrEvent {
  return event(
    createNip29ReleaseMessageTemplate(
      "demo",
      {
        url: "https://assets.example/manifest.json",
        mimeType: "application/json",
        sha256: manifestHash,
        size: 200,
      },
      100,
      "Demo 1.0.0",
    ),
    "3".repeat(64),
    pubkey,
  );
}

function decision(
  releaseId: string,
  value: "approved" | "rejected" | "revoked",
  createdAt: number,
): NostrEvent {
  return event(
    createNip29CuratorDecisionTemplate(releaseId, value, createdAt),
    String(createdAt).padStart(64, "0"),
    curator,
  );
}

function manifest(version: unknown = "1.0.0") {
  return {
    schema: "lapis.registry.nip29-release/1",
    plugin: {
      schema: "lapis.registry.plugin/1",
      pluginId: "demo",
      name: "Demo",
      description: "A release preview",
      channel: "official",
      status: "active",
      index: {
        author: "Lapis",
        minAppVersion: "0.1.0",
        platforms: ["web"],
        categories: ["productivity"],
        owner: { name: "Lapis", verified: true },
      },
      detail: {
        schemaVersion: 1,
        author: "Lapis",
        owner: { name: "Lapis", verified: true },
      },
    },
    release: {
      schema: "lapis.registry.release/1",
      pluginId: "demo",
      version,
      minAppVersion: "0.1.0",
      platforms: ["web"],
      releasedAt: "2026-09-03T10:00:00.000Z",
      artifact: {
        url: "https://assets.example/demo.lapis-plugin",
        sha256: "b".repeat(64),
        size: 100,
      },
      metadata: {},
    },
  };
}

describe("registry release inspection", () => {
  it.each([
    ["pending", []],
    ["approved", ["approved"]],
    ["rejected", ["rejected"]],
    ["revoked", ["revoked"]],
  ] as const)("reports deterministic %s state", (state, decisions) => {
    const release = releaseEvent();
    const candidate = recognizeRegistryReleaseCandidate(release, authorities)!;
    const related = decisions.map((value, index) =>
      decision(release.id, value, 101 + index),
    );
    expect(
      inspectRegistryReleaseCandidate(
        candidate,
        [release, ...related],
        manifest(),
        "2026-09-03T12:00:00.000Z",
        authorities,
      ),
    ).toMatchObject({
      state,
      pluginId: "demo",
      version: "1.0.0",
      preview: { entry: { id: "demo" }, detail: { id: "demo" } },
    });
  });

  it("reports precise safe schema paths", () => {
    const release = releaseEvent();
    const candidate = recognizeRegistryReleaseCandidate(release, authorities)!;
    const inspected = inspectRegistryReleaseCandidate(
      candidate,
      [release],
      manifest(42),
      "2026-09-03T12:00:00.000Z",
      authorities,
    );
    expect(inspected.state).toBe("invalid");
    expect(inspected.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "release.version" }),
      ]),
    );
    expect(inspected.preview).toBeUndefined();
  });

  it("fails closed before inspecting content from an untrusted publisher", () => {
    const release = releaseEvent("4".repeat(64));
    const candidate = recognizeRegistryReleaseCandidate(release, authorities)!;
    const inspected = inspectRegistryReleaseCandidate(
      candidate,
      [release],
      manifest(),
      "2026-09-03T12:00:00.000Z",
      authorities,
    );
    expect(inspected).toMatchObject({ state: "untrusted" });
    expect(inspected.preview).toBeUndefined();
  });

  it("ignores curator reactions outside the canonical release group", () => {
    const release = releaseEvent();
    const candidate = recognizeRegistryReleaseCandidate(release, authorities)!;
    const offGroup = {
      ...decision(release.id, "approved", 101),
      tags: [
        ["h", lapisGroupId("another-group")],
        ["e", release.id],
      ],
    };
    expect(
      inspectRegistryReleaseCandidate(
        candidate,
        [release, offGroup],
        manifest(),
        "2026-09-03T12:00:00.000Z",
        authorities,
      ).state,
    ).toBe("pending");
  });
});
