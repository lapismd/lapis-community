import { describe, expect, it } from "vitest";
import { npubEncode } from "nostr-tools/nip19";

import {
  communityComposerReferenceTokens,
  composerPreferredMemberIds,
  composerTokenMember,
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

  it("scans draft nostr npub text as the same mention token", () => {
    const ada = "a".repeat(64);
    const token = `nostr:${npubEncode(ada)}`;
    const adaMember = {
      id: ada,
      name: "Ada Lovelace",
      handle: "ada",
      initials: "AL",
    };
    expect(
      communityComposerReferenceTokens([adaMember], [], [], [], `${token} hi`),
    ).toEqual([
      { token: "@Ada Lovelace", kind: "mention", memberId: ada },
      { token, kind: "mention", memberId: ada },
    ]);
    expect(composerTokenMember(ada, [adaMember], token)).toEqual(adaMember);
  });

  it("keeps unknown draft npub text as a mention token", () => {
    const guest = "c".repeat(64);
    const token = `nostr:${npubEncode(guest)}`;
    expect(communityComposerReferenceTokens([], [], [], [], token)).toEqual([
      { token, kind: "mention", memberId: guest },
    ]);
    expect(composerTokenMember(guest, [], token)?.name).toMatch(/^npub1/u);
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
