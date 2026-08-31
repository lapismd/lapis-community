import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from "nostr-tools/pure";
import { describe, expect, it } from "vitest";

import {
  createSnapshotContent,
  eventAddress,
  materializeRegistry,
  projectV1,
  TEST_REGISTRY_KINDS,
  verifySnapshot,
} from "./index.js";
import type {
  ApprovalContent,
  AssessmentContent,
  ModerationContent,
  NostrEvent,
  PluginDefinitionContent,
  RegistryAuthorities,
  ReleaseContent,
  RevocationContent,
  SnapshotContent,
} from "./types.js";

const publisherKey = generateSecretKey();
const assessorKey = generateSecretKey();
const curatorKey = generateSecretKey();
const moderatorKey = generateSecretKey();
const snapshotKey = generateSecretKey();
const attackerKey = generateSecretKey();

const publisher = getPublicKey(publisherKey);
const assessor = getPublicKey(assessorKey);
const curator = getPublicKey(curatorKey);
const moderator = getPublicKey(moderatorKey);
const snapshotSigner = getPublicKey(snapshotKey);

const authorities: RegistryAuthorities = {
  assessorPubkeys: new Set([assessor]),
  curatorPubkeys: new Set([curator]),
  moderatorPubkeys: new Set([moderator]),
  snapshotSignerPubkeys: new Set([snapshotSigner]),
  registryOperatorPubkeys: new Set([curator]),
  publisherPubkeysByPlugin: new Map([["wordcount", new Set([publisher])]]),
};

function signed(
  secret: Uint8Array,
  kind: number,
  created_at: number,
  tags: string[][],
  content: object,
): NostrEvent {
  return finalizeEvent(
    { kind, created_at, tags, content: JSON.stringify(content) },
    secret,
  );
}

function fixture(): {
  approval: NostrEvent;
  assessment: NostrEvent;
  events: NostrEvent[];
  plugin: NostrEvent;
  release: NostrEvent;
} {
  const pluginContent: PluginDefinitionContent = {
    schema: "lapis.registry.plugin/1",
    pluginId: "wordcount",
    name: "Word Count",
    description: "Status bar word and character count",
    channel: "official",
    status: "active",
    index: {
      author: "Lapis Notes",
      categories: ["editor", "productivity"],
      schemaVersion: 1,
    },
    detail: {
      license: "AGPL-3.0-or-later",
      schemaVersion: 1,
    },
  };
  const plugin = signed(
    publisherKey,
    TEST_REGISTRY_KINDS.softwareApplication,
    1_700_000_000,
    [["d", "wordcount"]],
    pluginContent,
  );

  const artifactSha256 = "ab".repeat(32);
  const releaseContent: ReleaseContent = {
    schema: "lapis.registry.release/1",
    pluginId: "wordcount",
    version: "1.2.3",
    minAppVersion: "0.1.0",
    platforms: ["web", "electron"],
    releasedAt: "2026-08-31T10:00:00.000Z",
    artifact: {
      url: "https://example.test/wordcount-1.2.3.lapis-plugin",
      downloadUrl: "../../download/wordcount/1.2.3",
      sha256: artifactSha256,
      size: 50_493,
    },
    metadata: { version: "1.2.3" },
  };
  const release = signed(
    publisherKey,
    TEST_REGISTRY_KINDS.releaseArtifactSet,
    1_700_000_001,
    [
      ["d", "wordcount@1.2.3"],
      [
        "a",
        eventAddress(
          TEST_REGISTRY_KINDS.softwareApplication,
          publisher,
          "wordcount",
        ),
      ],
      ["x", artifactSha256],
    ],
    releaseContent,
  );

  const assessmentContent: AssessmentContent = {
    schema: "lapis.registry.assessment/1",
    releaseEventId: release.id,
    artifactSha256,
    status: "pass",
    checks: [
      { id: "bundle-digest", status: "pass" },
      { id: "malware-scan", status: "pass" },
    ],
  };
  const assessment = signed(
    assessorKey,
    TEST_REGISTRY_KINDS.assessmentLabel,
    1_700_000_002,
    [
      ["e", release.id, "", "release"],
      ["x", artifactSha256],
    ],
    assessmentContent,
  );

  const approvalContent: ApprovalContent = {
    schema: "lapis.registry.approval/1",
    pluginId: "wordcount",
    version: "1.2.3",
    releaseEventId: release.id,
    assessmentEventId: assessment.id,
    artifactSha256,
    decision: "approved",
  };
  const approval = signed(
    curatorKey,
    TEST_REGISTRY_KINDS.approval,
    1_700_000_003,
    [
      ["d", "wordcount@1.2.3"],
      ["e", release.id, "", "release"],
      ["e", assessment.id, "", "assessment"],
      ["x", artifactSha256],
    ],
    approvalContent,
  );

  return {
    plugin,
    release,
    assessment,
    approval,
    events: [plugin, release, assessment, approval],
  };
}

describe("materializeRegistry", () => {
  it("requires an exact passing assessment and curator approval", () => {
    const { events } = fixture();
    const registry = materializeRegistry(
      events,
      TEST_REGISTRY_KINDS,
      authorities,
    );

    expect(registry.issues).toEqual([]);
    expect(registry.plugins).toHaveLength(1);
    expect(registry.plugins[0]?.latestVersion).toBe("1.2.3");
    expect(registry.acceptedEventIds).toHaveLength(4);

    const v1 = projectV1(registry, "2026-08-31T12:00:00.000Z");
    expect(v1.index.plugins).toMatchObject([
      {
        id: "wordcount",
        latestVersion: "1.2.3",
        latestRelease: {
          bundleSize: 50_493,
          releasedAt: "2026-08-31T10:00:00.000Z",
        },
      },
    ]);
    expect(v1.plugins.get("wordcount")?.versions).toMatchObject({
      "1.2.3": {
        bundle: { sha256: "ab".repeat(32), size: 50_493 },
      },
    });
    expect(v1.plugins.get("wordcount")?.nostr).toEqual({
      address: eventAddress(
        TEST_REGISTRY_KINDS.softwareApplication,
        publisher,
        "wordcount",
      ),
      eventId: events[0]?.id,
      kind: TEST_REGISTRY_KINDS.softwareApplication,
      publisherPubkey: publisher,
    });
  });

  it("is deterministic across relay order and duplicate delivery", () => {
    const { events } = fixture();
    const first = materializeRegistry(events, TEST_REGISTRY_KINDS, authorities);
    const replayed = materializeRegistry(
      [...events.toReversed(), events[1]!, events[0]!],
      TEST_REGISTRY_KINDS,
      authorities,
    );

    expect(replayed.root).toBe(first.root);
    expect(replayed.acceptedEventIds).toEqual(first.acceptedEventIds);
    expect(replayed.plugins).toEqual(first.plugins);
  });

  it("rejects an unauthorized approval and a mismatched artifact approval", () => {
    const base = fixture();
    const approvalContent = JSON.parse(
      base.approval.content,
    ) as ApprovalContent;
    const unauthorized = signed(
      attackerKey,
      TEST_REGISTRY_KINDS.approval,
      1_700_000_004,
      base.approval.tags,
      approvalContent,
    );
    const wrongHash = "cd".repeat(32);
    const mismatchedContent = { ...approvalContent, artifactSha256: wrongHash };
    const mismatched = signed(
      curatorKey,
      TEST_REGISTRY_KINDS.approval,
      1_700_000_005,
      base.approval.tags.map((tag) =>
        tag[0] === "x" ? ["x", wrongHash] : tag,
      ),
      mismatchedContent,
    );

    const registry = materializeRegistry(
      [base.plugin, base.release, base.assessment, unauthorized, mismatched],
      TEST_REGISTRY_KINDS,
      authorities,
    );

    expect(registry.plugins).toEqual([]);
    expect(registry.exclusionCounts).toEqual({ "approval-missing": 1 });
    expect(registry.issues).toContainEqual({
      eventId: unauthorized.id,
      code: "authority",
      message: "Approval signer is not a curator",
    });
  });

  it("retains transparent moderation and revocation exclusion counts", () => {
    const base = fixture();
    const moderationContent: ModerationContent = {
      schema: "lapis.registry.moderation/1",
      target: { type: "publisher", pubkey: publisher },
      action: "mute",
      reason: "Curated projection policy fixture",
    };
    const moderation = signed(
      moderatorKey,
      TEST_REGISTRY_KINDS.moderationDecision,
      1_700_000_004,
      [["p", publisher]],
      moderationContent,
    );
    const revocationContent: RevocationContent = {
      schema: "lapis.registry.revocation/1",
      target: { scope: "artifact", sha256: "ff".repeat(32) },
      reason: "Unrelated retained control event",
    };
    const revocation = signed(
      curatorKey,
      TEST_REGISTRY_KINDS.revocation,
      1_700_000_005,
      [["x", "ff".repeat(32)]],
      revocationContent,
    );

    const registry = materializeRegistry(
      [...base.events, moderation, revocation],
      TEST_REGISTRY_KINDS,
      authorities,
    );

    expect(registry.plugins).toEqual([]);
    expect(registry.exclusionCounts).toEqual({ "publisher-muted": 2 });
    expect(registry.acceptedEventIds).toEqual(
      [moderation.id, revocation.id].toSorted(),
    );
  });

  it("retains a NIP-56 community report without treating it as moderation", () => {
    const base = fixture();
    const report = finalizeEvent(
      {
        kind: TEST_REGISTRY_KINDS.moderationReport,
        created_at: 1_700_000_004,
        tags: [
          ["p", publisher, "malware"],
          ["e", base.release.id, "malware"],
        ],
        content: "Untrusted community report fixture",
      },
      attackerKey,
    );

    const registry = materializeRegistry(
      [...base.events, report],
      TEST_REGISTRY_KINDS,
      authorities,
    );

    expect(registry.plugins).toHaveLength(1);
    expect(registry.exclusions).toEqual([]);
    expect(registry.issues).toEqual([]);
    expect(registry.acceptedEventIds).not.toContain(report.id);
  });

  it("verifies snapshots only from the distinct configured signer", () => {
    const { events } = fixture();
    const registry = materializeRegistry(
      events,
      TEST_REGISTRY_KINDS,
      authorities,
    );
    const content: SnapshotContent = createSnapshotContent(
      registry,
      "2026-08-31T12:00:00.000Z",
    );
    const tags = [
      ["d", "official"],
      ["x", registry.root],
    ];
    const snapshot = signed(
      snapshotKey,
      TEST_REGISTRY_KINDS.snapshot,
      1_700_000_006,
      tags,
      content,
    );
    const wrongSigner = signed(
      curatorKey,
      TEST_REGISTRY_KINDS.snapshot,
      1_700_000_006,
      tags,
      content,
    );

    expect(
      verifySnapshot(snapshot, registry, TEST_REGISTRY_KINDS, authorities),
    ).toBe(true);
    expect(
      verifySnapshot(wrongSigner, registry, TEST_REGISTRY_KINDS, authorities),
    ).toBe(false);
  });

  it("drops tampered events before parsing registry content", () => {
    const base = fixture();
    const tampered = {
      ...base.release,
      content: base.release.content.replace("1.2.3", "9.9.9"),
    };
    const registry = materializeRegistry(
      [base.plugin, tampered, base.assessment, base.approval],
      TEST_REGISTRY_KINDS,
      authorities,
    );

    expect(registry.plugins).toEqual([]);
    expect(registry.issues).toContainEqual({
      eventId: tampered.id,
      code: "signature",
      message: "Event id or signature verification failed",
    });
  });
});
