import { describe, expect, it } from "vitest";
import { npubEncode } from "nostr-tools/nip19";

import type {
  CommunityMemberModel,
  CommunityRoomModel,
} from "../community-workspace/model.js";
import {
  isFencedCodePosition,
  isInlineCodePosition,
  isSafeCommunityEmojiUrl,
  isSafeCommunityLink,
  resolveCommunityComposerReferences,
  tokenAppears,
} from "./model.js";

const members: CommunityMemberModel[] = [
  { id: "ada", name: "Ada Lovelace", handle: "ada", initials: "AL" },
  { id: "ben", name: "Ben", handle: "ben", initials: "B" },
  { id: "other-ben", name: "Ben", handle: "ben-2", initials: "B2" },
];
const rooms: CommunityRoomModel[] = [
  { id: "general", name: "general", kind: "channel" },
  { id: "support", name: "support ai", kind: "forum" },
  { id: "duplicate", name: "general", kind: "forum" },
  { id: "archived", name: "archive", kind: "channel", archived: true },
  { id: "dm", name: "Ada Lovelace", kind: "direct" },
];

describe("community composer references", () => {
  it("retains selected identities and resolves only unique manual tokens", () => {
    expect(
      resolveCommunityComposerReferences(
        "Hello @Ada Lovelace and @Ben in #general and #support ai",
        members,
        rooms,
        ["other-ben"],
        ["duplicate"],
      ),
    ).toEqual({
      mentionPubkeys: ["ada", "other-ben"],
      channelIds: ["support", "duplicate"],
    });
  });

  it("does not resolve archived, direct, partial, or current-member tokens", () => {
    expect(
      resolveCommunityComposerReferences(
        "@Ada Lovelace #archive #Ada Lovelace #generally",
        members,
        rooms,
        [],
        [],
        "ada",
      ),
    ).toEqual({ mentionPubkeys: [], channelIds: [] });
  });

  it("keeps NIP-27 content mentions as publish pubkeys", () => {
    const ada = "a".repeat(64);
    expect(
      resolveCommunityComposerReferences(
        `nostr:${npubEncode(ada)} please inspect README`,
        [{ id: ada, name: "Ada Lovelace", handle: "ada", initials: "AL" }],
        rooms,
      ),
    ).toEqual({ mentionPubkeys: [ada], channelIds: [] });
  });

  it("matches labels with spaces on token boundaries", () => {
    expect(tokenAppears("Hi @Ada Lovelace!", "@", "Ada Lovelace")).toBe(true);
    expect(tokenAppears("mail@example.com", "@", "example")).toBe(false);
    expect(tokenAppears("#general-purpose", "#", "general")).toBe(false);
  });
});

describe("community composer markdown context", () => {
  it("detects fenced and inline code positions", () => {
    const fenced = "Before\n```ts\nconst answer = 42;";
    expect(isFencedCodePosition(fenced, fenced.length)).toBe(true);
    expect(
      isFencedCodePosition(`${fenced}\n\`\`\`\nAfter`, fenced.length + 6),
    ).toBe(false);
    expect(isInlineCodePosition("Use `const value", 16)).toBe(true);
    expect(isInlineCodePosition("Use `const value` now", 21)).toBe(false);
  });

  it("accepts only supported link destinations", () => {
    expect(isSafeCommunityLink("https://lapis.md/docs")).toBe(true);
    expect(isSafeCommunityLink("nostr:npub1example")).toBe(true);
    expect(isSafeCommunityLink("/plugins/ai")).toBe(true);
    expect(isSafeCommunityLink("javascript:alert(1)")).toBe(false);
    expect(isSafeCommunityLink("data:text/html,bad")).toBe(false);
  });

  it("accepts only renderable custom emoji image sources", () => {
    expect(isSafeCommunityEmojiUrl("https://cdn.example/lapis.webp")).toBe(
      true,
    );
    expect(isSafeCommunityEmojiUrl("data:image/svg+xml,%3Csvg/%3E")).toBe(true);
    expect(isSafeCommunityEmojiUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeCommunityEmojiUrl("data:text/html,bad")).toBe(false);
  });
});
