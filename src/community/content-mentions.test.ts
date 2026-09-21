import { describe, expect, it } from "vitest";
import { npubEncode, nprofileEncode } from "nostr-tools/nip19";

import {
  contentMentionFromHref,
  contentMentionLabel,
  contentMentionMatches,
  contentMentionPubkeys,
  decodeContentMention,
} from "./content-mentions.js";

const ada = "a".repeat(64);
const ben = "b".repeat(64);

describe("content mentions", () => {
  it("decodes npub and nprofile tokens", () => {
    expect(decodeContentMention(npubEncode(ada))).toBe(ada);
    expect(
      decodeContentMention(`nostr:${nprofileEncode({ pubkey: ben })}`),
    ).toBe(ben);
    expect(decodeContentMention("npub1qq")).toBeUndefined();
  });

  it("collects unique pubkeys from published NIP-27 tokens", () => {
    const content = `Hi nostr:${npubEncode(ada)} and nostr:${nprofileEncode({
      pubkey: ada,
    })} plus nostr:${npubEncode(ben)}`;
    expect(contentMentionPubkeys(content)).toEqual([ada, ben]);
    expect(contentMentionMatches(content).map((item) => item.pubkey)).toEqual([
      ada,
      ada,
      ben,
    ]);
  });

  it("reads mention identity from a Mira nostr autolink", () => {
    expect(contentMentionFromHref(`nostr:${npubEncode(ada)}`)).toEqual({
      value: `nostr:${npubEncode(ada)}`,
      pubkey: ada,
    });
    expect(contentMentionFromHref("https://lapis.md")).toBeUndefined();
  });

  it("prefers the known member label over the bech32 source", () => {
    expect(
      contentMentionLabel(ada, `nostr:${npubEncode(ada)}`, [
        { id: ada, name: "Ada Lovelace" },
      ]),
    ).toBe("@Ada Lovelace");
    expect(contentMentionLabel(ada, `nostr:${npubEncode(ada)}`, [])).toBe(
      `nostr:${npubEncode(ada)}`,
    );
  });
});
