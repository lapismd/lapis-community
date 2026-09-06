import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from "nostr-tools/pure";
import { describe, expect, it } from "vitest";

import {
  NIP29_KINDS,
  createNip29CuratorDecisionTemplate,
  createNip29ForumCommentTemplate,
  createNip29ForumThreadTemplate,
  createNip29PublisherAuthorizationTemplate,
  createNip29PublisherWithdrawalTemplate,
  createNip29RegistryHeadTemplate,
  createNip29ReleaseMessageTemplate,
  LAPIS_GROUPS,
  lapisGroupId,
  lapisPluginSupportGroupId,
  materializeNip29Registry,
  projectNip29Registry,
} from "./nip29.js";
import type {
  NostrEvent,
  NostrEventTemplate,
  PluginDefinitionContent,
  ReleaseContent,
  SequencedReleaseContent,
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
  detail: { license: "Apache-2.0" },
};

const releaseManifest: ReleaseContent = {
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
const manifest = {
  schema: "lapis.registry.nip29-release/1" as const,
  plugin,
  release: releaseManifest,
};

function sign(secret: Uint8Array, template: NostrEventTemplate): NostrEvent {
  return finalizeEvent(template, secret);
}

describe("NIP-29 registry protocol", () => {
  it("derives stable NIP-29 group ids from the documented names", () => {
    expect(lapisGroupId(LAPIS_GROUPS.pluginReleases)).toBe(
      "d792e601-8c97-5ac6-9446-d8215835de3c",
    );
    expect(lapisGroupId(LAPIS_GROUPS.forums)).toBe(
      "650b8354-2725-5674-b6a0-46b0b68b227e",
    );
    expect(lapisPluginSupportGroupId("ai")).toBe(lapisGroupId("support/ai"));
  });

  it("uses standard NIP-29/Nostr kinds for release, decision, and forum events", () => {
    const release = createNip29ReleaseMessageTemplate(
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
    const decision = createNip29CuratorDecisionTemplate(
      "c".repeat(64),
      "approved",
      1,
    );
    expect(decision.kind).toBe(NIP29_KINDS.reaction);
    expect(decision.tags).toContainEqual([
      "h",
      lapisGroupId(LAPIS_GROUPS.pluginReleases),
    ]);
    const root = sign(
      publisherKey,
      createNip29ForumThreadTemplate("group", "root", 1),
    );
    expect(root).toMatchObject({
      kind: 11,
      tags: expect.arrayContaining([["title", "root"]]),
    });
    expect(
      createNip29ForumCommentTemplate(
        "group",
        root,
        root,
        "reply",
        2,
        "wss://relay.example",
      ),
    ).toMatchObject({
      kind: 1_111,
      tags: expect.arrayContaining([
        ["E", root.id, "wss://relay.example", root.pubkey],
        ["K", "11"],
        ["e", root.id, "wss://relay.example", root.pubkey],
        ["k", "11"],
      ]),
    });
  });

  it("materializes only configured publishers with the latest trusted curator decision", () => {
    const release = sign(
      publisherKey,
      createNip29ReleaseMessageTemplate(
        "ai",
        attachment,
        1_700_000_000,
        "AI 1.2.3 is ready for review",
      ),
    );
    const attackerRelease = sign(
      attackerKey,
      createNip29ReleaseMessageTemplate(
        "ai",
        attachment,
        1_700_000_001,
        "spoofed release",
      ),
    );
    const untrustedApproval = sign(
      attackerKey,
      createNip29CuratorDecisionTemplate(release.id, "approved", 1_700_000_002),
    );
    const rejected = sign(
      curatorKey,
      createNip29CuratorDecisionTemplate(release.id, "rejected", 1_700_000_003),
    );
    const approved = sign(
      curatorKey,
      createNip29CuratorDecisionTemplate(release.id, "approved", 1_700_000_004),
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

    const result = materializeNip29Registry(input, sources, options);
    const replay = materializeNip29Registry(
      [...input, release].toReversed(),
      sources,
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

    const projection = projectNip29Registry(result, "2026-09-01T12:30:00.000Z");
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
      createNip29ReleaseMessageTemplate("ai", attachment, 10, "release"),
    );
    const approved = sign(
      curatorKey,
      createNip29CuratorDecisionTemplate(release.id, "approved", 11),
    );
    const revoked = sign(
      curatorKey,
      createNip29CuratorDecisionTemplate(release.id, "revoked", 12),
    );
    const result = materializeNip29Registry(
      [release, approved, revoked],
      [{ attachmentSha256: attachment.sha256, manifest }],
      {
        curatorPubkeys: new Set([curator]),
        publisherPubkeysByPlugin: new Map([["ai", new Set([publisher])]]),
      },
    );
    expect(result.plugins).toEqual([]);
    expect(result.acceptedEventIds).toEqual([]);
  });

  it("materializes a contiguous v2 release only through a fresh signed head", () => {
    const v2Attachment = {
      ...attachment,
      sha256: "c".repeat(64),
      url: `https://relay.example/media/${"c".repeat(64)}.json`,
    };
    const v2Release: SequencedReleaseContent = {
      ...releaseManifest,
      schema: "lapis.registry.release/2",
      version: "2.0.0",
      releaseSequence: "1",
      artifact: { ...releaseManifest.artifact, sha256: "d".repeat(64) },
    };
    const release = sign(
      publisherKey,
      createNip29ReleaseMessageTemplate("ai", v2Attachment, 100, "AI 2"),
    );
    const approval = sign(
      curatorKey,
      createNip29CuratorDecisionTemplate(release.id, "approved", 101),
    );
    const issuedAt = new Date(102_000);
    const head = sign(
      curatorKey,
      createNip29RegistryHeadTemplate(
        {
          schema: "lapis.registry.plugin-head/1",
          pluginId: "ai",
          authorityEpoch: "epoch-1",
          headRevision: "1",
          activeReleaseEventId: release.id,
          releases: [
            {
              releaseEventId: release.id,
              manifestSha256: v2Attachment.sha256,
              version: "2.0.0",
              releaseSequence: "1",
              state: "approved",
              decisionEventId: approval.id,
            },
          ],
          issuedAt: issuedAt.toISOString(),
          validUntil: new Date(
            issuedAt.getTime() + 30 * 24 * 60 * 60 * 1_000,
          ).toISOString(),
        },
        102,
      ),
    );
    const authorities = {
      curatorPubkeys: new Set([curator]),
      publisherPubkeysByPlugin: new Map([["ai", new Set([publisher])]]),
      authorityEpoch: "epoch-1",
    };
    const sources = [
      {
        attachmentSha256: v2Attachment.sha256,
        manifest: {
          schema: "lapis.registry.nip29-release/2",
          plugin,
          release: v2Release,
        },
      },
    ];
    const result = materializeNip29Registry(
      [release, approval, head],
      sources,
      authorities,
      { now: new Date(103_000) },
    );
    expect(result.plugins[0]).toMatchObject({
      latestVersion: "2.0.0",
      releases: [{ head: { event: { id: head.id }, fresh: true } }],
    });
    expect(result.heads.get("ai")?.content.headRevision).toBe("1");

    const withdrawal = sign(
      publisherKey,
      createNip29PublisherWithdrawalTemplate(release.id, 104),
    );
    expect(
      materializeNip29Registry(
        [release, approval, head, withdrawal],
        sources,
        authorities,
        { now: new Date(105_000) },
      ).plugins,
    ).toEqual([]);
  });

  it("derives publisher authority from curator events and rejects off-group decisions", () => {
    const signedAuthorization = sign(
      curatorKey,
      createNip29PublisherAuthorizationTemplate(
        "ai",
        publisher,
        "authorized",
        9,
      ),
    );
    const release = sign(
      publisherKey,
      createNip29ReleaseMessageTemplate("ai", attachment, 10, "release"),
    );
    const approval = sign(
      curatorKey,
      createNip29CuratorDecisionTemplate(release.id, "approved", 11),
    );
    const authorities = {
      curatorPubkeys: new Set([curator]),
      publisherPubkeysByPlugin: new Map(),
    };

    const accepted = materializeNip29Registry(
      [approval, release, signedAuthorization],
      [{ attachmentSha256: attachment.sha256, manifest }],
      authorities,
    );
    expect(accepted.plugins).toHaveLength(1);
    expect(accepted.acceptedEventIds).toEqual(
      [approval.id, release.id, signedAuthorization.id].toSorted(),
    );

    const offGroupApproval = sign(curatorKey, {
      ...createNip29CuratorDecisionTemplate(release.id, "approved", 12),
      tags: [
        ["h", lapisGroupId("another-group")],
        ["e", release.id],
      ],
    });
    expect(
      materializeNip29Registry(
        [offGroupApproval, release, signedAuthorization],
        [{ attachmentSha256: attachment.sha256, manifest }],
        authorities,
      ).plugins,
    ).toEqual([]);

    const revokedAuthorization = sign(
      curatorKey,
      createNip29PublisherAuthorizationTemplate("ai", publisher, "revoked", 13),
    );
    expect(
      materializeNip29Registry(
        [approval, release, signedAuthorization, revokedAuthorization],
        [{ attachmentSha256: attachment.sha256, manifest }],
        authorities,
      ).plugins,
    ).toEqual([]);
  });
});
