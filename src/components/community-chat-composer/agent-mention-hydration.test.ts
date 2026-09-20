import { describe, expect, it } from "vitest";

import {
  canHydrateAgentMentions,
  hydrateAgentMentionDraft,
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
    ).toBe("@Fizz @BHoney please continue");
  });

  it("restores authored order with a trailing space", () => {
    expect(
      restoreAgentMentionDraft(
        [agentB],
        [agentA, agentB],
        (pubkey) => names[pubkey],
      ),
    ).toBe("@BHoney @Fizz ");
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
  });
});
