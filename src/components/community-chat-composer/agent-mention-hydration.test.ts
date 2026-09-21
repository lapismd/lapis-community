import { describe, expect, it } from "vitest";
import { npubEncode } from "nostr-tools/nip19";

import {
  canHydrateAgentMentions,
  hydrateAgentMentionDraft,
  presentAgentMentionPubkeys,
  removedAgentMentionPubkeys,
  restoreAgentMentionDraft,
  stripAgentMention,
} from "./agent-mention-hydration.js";

const agentA = "a".repeat(64);
const agentB = "b".repeat(64);
const names: Record<string, string> = {
  [agentA]: "Fizz",
  [agentB]: "BHoney",
};

describe("agent mention hydration", () => {
  it("prefixes missing addressed agents", () => {
    expect(
      hydrateAgentMentionDraft(
        "please continue",
        [agentA, agentB],
        (pubkey) => names[pubkey],
      ),
    ).toBe(
      `nostr:${npubEncode(agentA)} nostr:${npubEncode(agentB)} please continue`,
    );
  });

  it("treats an existing NIP-27 token as already present", () => {
    expect(
      presentAgentMentionPubkeys(
        `nostr:${npubEncode(agentA)} keep going`,
        [agentA, agentB],
        (pubkey) => names[pubkey],
      ),
    ).toEqual([agentA]);
  });

  it("restores authored order with a trailing space", () => {
    expect(
      restoreAgentMentionDraft(
        [agentB],
        [agentA, agentB],
        (pubkey) => names[pubkey],
      ),
    ).toBe(`nostr:${npubEncode(agentB)} nostr:${npubEncode(agentA)} `);
  });

  it("reconciles deleted mentions", () => {
    expect(
      removedAgentMentionPubkeys(
        "@Fizz keep going",
        [agentA, agentB],
        (pubkey) => names[pubkey],
      ),
    ).toEqual([agentB]);
  });

  it("skips edit context and missing scopes", () => {
    expect(
      canHydrateAgentMentions({ kind: "edit", id: "1" }, true, "scope"),
    ).toBe(false);
    expect(canHydrateAgentMentions(undefined, true, null)).toBe(false);
    expect(canHydrateAgentMentions(undefined, true, "scope")).toBe(true);
  });

  it("strips a dismissed agent mention", () => {
    expect(
      stripAgentMention(
        "@Fizz please continue",
        agentA,
        (pubkey) => names[pubkey],
      ),
    ).toBe("please continue");
    expect(
      stripAgentMention(
        `nostr:${npubEncode(agentA)} please continue`,
        agentA,
        (pubkey) => names[pubkey],
      ),
    ).toBe("please continue");
  });
});
