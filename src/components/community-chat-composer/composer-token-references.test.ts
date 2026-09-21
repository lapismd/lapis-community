import { describe, expect, it } from "vitest";
import { npubEncode } from "nostr-tools/nip19";

import {
  communityComposerReferenceTokens,
  composerPreferredMemberIds,
  resolveComposerMentionMember,
} from "./composer-token-references.js";

const humanNyra = {
  id: "human-nyra",
  name: "Nyra",
  handle: "nyra-human",
  initials: "NY",
};
const agentNyra = {
  id: "agent-nyra",
  name: "Nyra",
  handle: "nyra",
  initials: "NY",
  kind: "agent" as const,
};

describe("composer token references", () => {
  it("keeps a colliding agent mention when that agent is addressed", () => {
    expect(
      communityComposerReferenceTokens(
        [humanNyra, agentNyra],
        [],
        [],
        [agentNyra.id],
      ),
    ).toEqual([
      {
        token: "@Nyra",
        kind: "mention",
        memberId: agentNyra.id,
      },
    ]);
  });

  it("prefers the only agent when a human shares the display name", () => {
    expect(
      resolveComposerMentionMember([humanNyra, agentNyra], new Set()),
    ).toEqual(agentNyra);
  });

  it("drops an unresolved human-only name collision", () => {
    expect(
      communityComposerReferenceTokens(
        [humanNyra, { ...humanNyra, id: "other-nyra", handle: "nyra-2" }],
        [],
        [],
      ),
    ).toEqual([]);
  });

  it("treats published NIP-27 npub tokens as the same mention", () => {
    const ada = "a".repeat(64);
    expect(
      communityComposerReferenceTokens(
        [{ id: ada, name: "Ada Lovelace", handle: "ada", initials: "AL" }],
        [],
        [],
      ),
    ).toEqual([
      { token: "@Ada Lovelace", kind: "mention", memberId: ada },
      { token: `nostr:${npubEncode(ada)}`, kind: "mention", memberId: ada },
    ]);
  });

  it("deduplicates selected and locked mention ids", () => {
    expect(
      composerPreferredMemberIds(
        [agentNyra.id, "  ", agentNyra.id],
        [agentNyra.id, humanNyra.id],
      ),
    ).toEqual([agentNyra.id, humanNyra.id]);
  });
});
