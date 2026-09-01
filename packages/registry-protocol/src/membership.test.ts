import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from "nostr-tools/pure";
import { describe, expect, it } from "vitest";

import {
  createMembershipDecisionTemplate,
  createMembershipRegistrationTemplate,
  materializeMembership,
  TEST_MEMBERSHIP_KINDS,
  type MembershipDecisionContent,
} from "./membership.js";
import type { NostrEvent, NostrEventTemplate } from "./types.js";

const memberKey = generateSecretKey();
const memberPubkey = getPublicKey(memberKey);
const adminKey = generateSecretKey();
const adminPubkey = getPublicKey(adminKey);
const attackerKey = generateSecretKey();

function sign(template: NostrEventTemplate, key: Uint8Array): NostrEvent {
  return finalizeEvent(template, key);
}

function decision(
  overrides: Partial<MembershipDecisionContent> = {},
): MembershipDecisionContent {
  return {
    schema: "lapis.registry.membership-decision/1",
    subjectPubkey: memberPubkey,
    status: "active",
    roles: ["publisher"],
    publisherPluginIds: ["ai"],
    reason: "Publisher verified",
    ...overrides,
  };
}

describe("membership protocol", () => {
  it("materializes a self-registration as an active member", () => {
    const registration = sign(
      createMembershipRegistrationTemplate(TEST_MEMBERSHIP_KINDS, 100),
      memberKey,
    );

    const result = materializeMembership(
      [registration],
      TEST_MEMBERSHIP_KINDS,
      new Set([adminPubkey]),
    );

    expect(result.states).toEqual([
      expect.objectContaining({
        pubkey: memberPubkey,
        status: "active",
        roles: ["member"],
        source: "self-registration",
      }),
    ]);
  });

  it("lets a trusted decision override a later self-registration", () => {
    const suspension = sign(
      createMembershipDecisionTemplate(
        decision({
          status: "suspended",
          roles: ["publisher"],
          reason: "Review pending",
        }),
        TEST_MEMBERSHIP_KINDS,
        100,
      ),
      adminKey,
    );
    const laterRegistration = sign(
      createMembershipRegistrationTemplate(TEST_MEMBERSHIP_KINDS, 200),
      memberKey,
    );

    const result = materializeMembership(
      [laterRegistration, suspension],
      TEST_MEMBERSHIP_KINDS,
      new Set([adminPubkey]),
    );

    expect(result.states[0]).toEqual(
      expect.objectContaining({
        status: "suspended",
        source: "administrative-decision",
      }),
    );
  });

  it("ignores decisions from untrusted identities", () => {
    const forged = sign(
      createMembershipDecisionTemplate(
        decision({ roles: ["curator"], publisherPluginIds: [] }),
        TEST_MEMBERSHIP_KINDS,
        100,
      ),
      attackerKey,
    );

    const result = materializeMembership(
      [forged],
      TEST_MEMBERSHIP_KINDS,
      new Set([adminPubkey]),
    );

    expect(result.states).toEqual([]);
    expect(result.issues).toEqual([
      expect.objectContaining({ code: "authority", eventId: forged.id }),
    ]);
  });

  it("adds member capability without granting publisher by inheritance", () => {
    const curator = sign(
      createMembershipDecisionTemplate(
        decision({
          roles: ["curator", "security"],
          publisherPluginIds: [],
        }),
        TEST_MEMBERSHIP_KINDS,
        100,
      ),
      adminKey,
    );

    const result = materializeMembership(
      [curator],
      TEST_MEMBERSHIP_KINDS,
      new Set([adminPubkey]),
    );

    expect(result.states[0]?.roles).toEqual(["curator", "member", "security"]);
    expect(result.states[0]?.roles).not.toContain("publisher");
  });

  it("is stable across relay order and duplicates", () => {
    const older = sign(
      createMembershipDecisionTemplate(
        decision({ status: "suspended", reason: "Older" }),
        TEST_MEMBERSHIP_KINDS,
        100,
      ),
      adminKey,
    );
    const newer = sign(
      createMembershipDecisionTemplate(
        decision({
          roles: ["security", "publisher"],
          publisherPluginIds: ["tasks", "ai"],
          reason: "Restored",
        }),
        TEST_MEMBERSHIP_KINDS,
        200,
      ),
      adminKey,
    );

    const first = materializeMembership(
      [older, newer],
      TEST_MEMBERSHIP_KINDS,
      new Set([adminPubkey]),
    );
    const second = materializeMembership(
      [newer, older, newer],
      TEST_MEMBERSHIP_KINDS,
      new Set([adminPubkey]),
    );

    expect(second.root).toBe(first.root);
    expect(second.states).toEqual(first.states);
    expect(first.states[0]).toEqual(
      expect.objectContaining({
        roles: ["member", "publisher", "security"],
        publisherPluginIds: ["ai", "tasks"],
      }),
    );
  });

  it("rejects publisher scopes without the publisher role", () => {
    expect(() =>
      createMembershipDecisionTemplate(
        decision({ roles: ["curator"] }),
        TEST_MEMBERSHIP_KINDS,
        100,
      ),
    ).toThrow("Publisher scopes require the publisher role");
  });
});
