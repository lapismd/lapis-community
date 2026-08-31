import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from "nostr-tools/pure";
import { describe, expect, it } from "vitest";

import {
  createSecurityAdvisoryTemplate,
  createSecurityDispositionTemplate,
  materializeSecurity,
  STANDARD_REGISTRY_KINDS,
  TEST_SECURITY_KINDS,
} from "./index.js";
import type {
  NostrEvent,
  SecurityAdvisoryContent,
  SecurityAuthorities,
  SecurityDispositionContent,
} from "./index.js";

const advisoryKey = generateSecretKey();
const dispositionKey = generateSecretKey();
const attackerKey = generateSecretKey();
const authorities: SecurityAuthorities = {
  advisoryPubkeys: new Set([getPublicKey(advisoryKey)]),
  dispositionPubkeys: new Set([getPublicKey(dispositionKey)]),
};
const releaseEventId = "a".repeat(64);
const artifactSha256 = "b".repeat(64);

function fixture(): {
  advisory: NostrEvent;
  advisoryContent: SecurityAdvisoryContent;
  disposition: NostrEvent;
  dispositionContent: SecurityDispositionContent;
} {
  const advisoryContent: SecurityAdvisoryContent = {
    schema: "lapis.registry.security-advisory/1",
    advisoryId: "LAPIS-2026-001",
    pluginId: "wordcount",
    releaseEventId,
    artifactSha256,
    severity: "high",
    summary: "Security review found an unsafe parser path",
    detailsUrl: "https://security.example.test/LAPIS-2026-001",
  };
  const advisory = finalizeEvent(
    createSecurityAdvisoryTemplate(
      advisoryContent,
      TEST_SECURITY_KINDS,
      1_800_000_000,
    ),
    advisoryKey,
  );
  const dispositionContent: SecurityDispositionContent = {
    schema: "lapis.registry.security-disposition/1",
    advisoryEventId: advisory.id,
    pluginId: advisoryContent.pluginId,
    releaseEventId,
    artifactSha256,
    action: "block",
    reason: "Block this exact artifact pending a fixed release",
  };
  const disposition = finalizeEvent(
    createSecurityDispositionTemplate(
      dispositionContent,
      TEST_SECURITY_KINDS,
      1_800_000_001,
    ),
    dispositionKey,
  );
  return { advisory, advisoryContent, disposition, dispositionContent };
}

describe("materializeSecurity", () => {
  it("enforces an authorized disposition against exact release bytes", () => {
    const { advisory, disposition } = fixture();
    const result = materializeSecurity(
      [advisory, disposition],
      TEST_SECURITY_KINDS,
      authorities,
    );

    expect(result.issues).toEqual([]);
    expect(result.statuses).toHaveLength(1);
    expect(result.statuses[0]).toMatchObject({
      enforcement: "block",
      advisory: { releaseEventId, artifactSha256 },
      disposition: { action: "block", releaseEventId, artifactSha256 },
    });
    expect(result.acceptedEventIds).toEqual(
      [advisory.id, disposition.id].toSorted(),
    );
  });

  it("never turns a NIP-56 community report into enforcement", () => {
    const { advisory } = fixture();
    const report = finalizeEvent(
      {
        kind: STANDARD_REGISTRY_KINDS.moderationReport,
        created_at: 1_800_000_001,
        tags: [
          ["p", advisory.pubkey, "malware"],
          ["e", advisory.id, "malware"],
          ["x", artifactSha256, "malware"],
        ],
        content: "Untrusted report",
      },
      attackerKey,
    );
    const result = materializeSecurity(
      [advisory, report],
      TEST_SECURITY_KINDS,
      authorities,
    );

    expect(result.statuses[0]?.enforcement).toBe("none");
    expect(result.acceptedEventIds).toEqual([advisory.id]);
    expect(result.issues).toEqual([]);
  });

  it("rejects a disposition from an unconfigured authority", () => {
    const { advisory, dispositionContent } = fixture();
    const unauthorized = finalizeEvent(
      createSecurityDispositionTemplate(
        dispositionContent,
        TEST_SECURITY_KINDS,
        1_800_000_001,
      ),
      attackerKey,
    );
    const result = materializeSecurity(
      [advisory, unauthorized],
      TEST_SECURITY_KINDS,
      authorities,
    );

    expect(result.statuses[0]?.enforcement).toBe("none");
    expect(result.issues).toContainEqual({
      eventId: unauthorized.id,
      code: "authority",
      message: "Security disposition signer is not trusted",
    });
  });

  it("rejects a disposition that carries over to a different hash", () => {
    const { advisory, dispositionContent } = fixture();
    const wrongHash = "c".repeat(64);
    const mismatched = finalizeEvent(
      createSecurityDispositionTemplate(
        { ...dispositionContent, artifactSha256: wrongHash },
        TEST_SECURITY_KINDS,
        1_800_000_001,
      ),
      dispositionKey,
    );
    const result = materializeSecurity(
      [advisory, mismatched],
      TEST_SECURITY_KINDS,
      authorities,
    );

    expect(result.statuses[0]?.enforcement).toBe("none");
    expect(result.issues).toContainEqual({
      eventId: mismatched.id,
      code: "reference",
      message: "Security disposition does not exactly match its advisory",
    });
  });

  it("rejects an advisory outside the supplied approved release set", () => {
    const { advisory } = fixture();
    const result = materializeSecurity(
      [advisory],
      TEST_SECURITY_KINDS,
      authorities,
      { trustedArtifactByRelease: new Map([[releaseEventId, "c".repeat(64)]]) },
    );

    expect(result.statuses).toEqual([]);
    expect(result.issues).toContainEqual({
      eventId: advisory.id,
      code: "reference",
      message: "Security advisory does not match an approved release artifact",
    });
  });

  it("applies the deterministic latest correction across order and replay", () => {
    const { advisory, disposition, dispositionContent } = fixture();
    const resolved = finalizeEvent(
      createSecurityDispositionTemplate(
        {
          ...dispositionContent,
          action: "resolved",
          reason: "The affected artifact has been withdrawn",
        },
        TEST_SECURITY_KINDS,
        1_800_000_002,
      ),
      dispositionKey,
    );
    const first = materializeSecurity(
      [advisory, disposition, resolved],
      TEST_SECURITY_KINDS,
      authorities,
    );
    const replayed = materializeSecurity(
      [resolved, advisory, disposition, resolved, advisory],
      TEST_SECURITY_KINDS,
      authorities,
    );

    expect(first.root).toBe(replayed.root);
    expect(first.statuses[0]?.enforcement).toBe("none");
    expect(first.statuses[0]?.dispositionEvent?.id).toBe(resolved.id);
    expect(first.acceptedEventIds).toEqual(
      [advisory.id, resolved.id].toSorted(),
    );
  });
});
