import { describe, expect, it } from "vitest";
import { npubEncode, nprofileEncode } from "nostr-tools/nip19";

import {
  contentMentionFallbackMember,
  contentMentionFromHref,
  contentMentionLabel,
  contentMentionMatches,
  contentMentionPubkeys,
  decodeContentMention,
  truncatedContentMention,
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
      `@${truncatedContentMention(`nostr:${npubEncode(ada)}`, ada)}`,
    );
    expect(
      contentMentionLabel(ada, `nostr:${npubEncode(ada)}`, [
        { id: ada, name: ada.slice(0, 12) },
      ]),
    ).toBe(`@${truncatedContentMention(`nostr:${npubEncode(ada)}`, ada)}`);
  });

  it("builds a truncated fallback member when no profile name exists", () => {
    const source = `nostr:${npubEncode(ben)}`;
    const handle = truncatedContentMention(source, ben);
    expect(contentMentionFallbackMember(ben, source)).toEqual({
      id: ben,
      name: handle,
      handle,
      initials: handle.replace(/^npub/iu, "").slice(0, 2).toUpperCase(),
    });
  });
});
