import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from "nostr-tools/pure";
import { describe, expect, it } from "vitest";

import {
  BUZZ_REGISTRY_KINDS,
  createBuzzCuratorDecisionTemplate,
  createBuzzForumReplyTemplate,
  createBuzzForumRootTemplate,
  createBuzzReleaseMessageTemplate,
  LAPIS_BUZZ_GROUP_PATHS,
  lapisBuzzGroupId,
  lapisPluginSupportGroupId,
  materializeBuzzRegistry,
  projectBuzzV1,
} from "./buzz.js";
import type {
  NostrEvent,
  NostrEventTemplate,
  PluginDefinitionContent,
  ReleaseContent,
} from "./types.js";

const publisherKey = generateSecretKey();
const curatorKey = generateSecretKey();
const attackerKey = generateSecretKey();
const publisher = getPublicKey(publisherKey);
const curator = getPublicKey(curatorKey);
const attachment = {
  url: "https://relay.example/media/" + "a".repeat(64) + ".json",
  mimeType: "application/json",
  sha256: "a".repeat(64),
  size: 512,
  filename: "manifest.json",
};

const plugin: PluginDefinitionContent = {
  schema: "lapis.registry.plugin/1",
  pluginId: "ai",
  name: "AI",
  description: "AI assistance for Lapis Notes",
  channel: "official",
  status: "active",
  index: { author: "Lapis Notes", categories: ["ai"] },
  detail: { license: "AGPL-3.0-or-later" },
};

const manifest: ReleaseContent = {
  schema: "lapis.registry.release/1",
  pluginId: "ai",
  version: "1.2.3",
  minAppVersion: "0.1.0",
  platforms: ["web", "desktop"],
  releasedAt: "2026-09-01T12:00:00.000Z",
  artifact: {
    url: "https://downloads.example/ai-1.2.3.lapis-plugin",
    sha256: "b".repeat(64),
    size: 42_000,
  },
  metadata: { version: "1.2.3" },
};

function sign(secret: Uint8Array, template: NostrEventTemplate): NostrEvent {
  return finalizeEvent(template, secret);
}

describe("Buzz-first registry protocol", () => {
  it("derives stable NIP-29 group ids from the documented names", () => {
    expect(lapisBuzzGroupId(LAPIS_BUZZ_GROUP_PATHS.pluginReleases)).toBe(
      "36c6a816-9330-581a-86fd-9a8d8091c39d",
    );
    expect(lapisBuzzGroupId(LAPIS_BUZZ_GROUP_PATHS.forums)).toBe(
      "5dccd936-e075-5b89-bd7e-a5345f8741de",
    );
    expect(lapisPluginSupportGroupId("ai")).toBe(
      lapisBuzzGroupId("support/ai"),
    );
  });

  it("uses standard Buzz/Nostr kinds for release, decision, and forum events", () => {
    const release = createBuzzReleaseMessageTemplate(
      "ai",
      attachment,
      1_700_000_000,
      "AI 1.2.3 is ready for review",
    );
    expect(release).toMatchObject({
      kind: 9,
      content: expect.stringContaining("1.2.3"),
    });
    expect(release.tags).toContainEqual(["t", "lapis-plugin-release"]);
    expect(release.tags).toContainEqual(["t", "plugin:ai"]);
    expect(
      createBuzzCuratorDecisionTemplate("c".repeat(64), "approved", 1).kind,
    ).toBe(BUZZ_REGISTRY_KINDS.reaction);
    expect(createBuzzForumRootTemplate("group", "root", 1).kind).toBe(45_001);
    expect(
      createBuzzForumReplyTemplate("group", "e".repeat(64), "reply", 2),
    ).toMatchObject({
      kind: 45_003,
      tags: expect.arrayContaining([["e", "e".repeat(64), "", "reply"]]),
    });
  });

  it("materializes only configured publishers with the latest trusted curator decision", () => {
    const release = sign(
      publisherKey,
      createBuzzReleaseMessageTemplate(
        "ai",
        attachment,
        1_700_000_000,
        "AI 1.2.3 is ready for review",
      ),
    );
    const attackerRelease = sign(
      attackerKey,
      createBuzzReleaseMessageTemplate(
        "ai",
        attachment,
        1_700_000_001,
        "spoofed release",
      ),
    );
    const untrustedApproval = sign(
      attackerKey,
      createBuzzCuratorDecisionTemplate(release.id, "approved", 1_700_000_002),
    );
    const rejected = sign(
      curatorKey,
      createBuzzCuratorDecisionTemplate(release.id, "rejected", 1_700_000_003),
    );
    const approved = sign(
      curatorKey,
      createBuzzCuratorDecisionTemplate(release.id, "approved", 1_700_000_004),
    );
    const input = [
      release,
      attackerRelease,
      untrustedApproval,
      rejected,
      approved,
    ];
    const options = {
      curatorPubkeys: new Set([curator]),
      publisherPubkeysByPlugin: new Map([["ai", new Set([publisher])]]),
    };
    const sources = [{ attachmentSha256: attachment.sha256, manifest }];

    const result = materializeBuzzRegistry(
      input,
      sources,
      [{ content: plugin }],
      options,
    );
    const replay = materializeBuzzRegistry(
      [...input, release].toReversed(),
      sources,
      [{ content: plugin }],
      options,
    );

    expect(result.root).toBe(replay.root);
    expect(result.plugins).toHaveLength(1);
    expect(result.plugins[0]).toMatchObject({
      latestVersion: "1.2.3",
      releases: [{ decision: "approved", decisionEvent: { id: approved.id } }],
    });
    expect(result.acceptedEventIds).toEqual(
      [approved.id, release.id].toSorted(),
    );
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventId: attackerRelease.id,
          code: "authority",
        }),
        expect.objectContaining({
          eventId: untrustedApproval.id,
          code: "authority",
        }),
      ]),
    );

    const projection = projectBuzzV1(result, "2026-09-01T12:30:00.000Z");
    expect(projection.index.plugins).toMatchObject([
      { id: "ai", latestVersion: "1.2.3" },
    ]);
    expect(projection.plugins.get("ai")?.versions).toMatchObject({
      "1.2.3": { bundle: { sha256: "b".repeat(64) } },
    });
  });

  it("fails closed when a later trusted decision revokes a release", () => {
    const release = sign(
      publisherKey,
      createBuzzReleaseMessageTemplate("ai", attachment, 10, "release"),
    );
    const approved = sign(
      curatorKey,
      createBuzzCuratorDecisionTemplate(release.id, "approved", 11),
    );
    const revoked = sign(
      curatorKey,
      createBuzzCuratorDecisionTemplate(release.id, "revoked", 12),
    );
    const result = materializeBuzzRegistry(
      [release, approved, revoked],
      [{ attachmentSha256: attachment.sha256, manifest }],
      [{ content: plugin }],
      {
        curatorPubkeys: new Set([curator]),
        publisherPubkeysByPlugin: new Map([["ai", new Set([publisher])]]),
      },
    );
    expect(result.plugins).toEqual([]);
    expect(result.acceptedEventIds).toEqual([]);
  });
});
