import { describe, expect, it } from "vitest";
import { npubEncode } from "nostr-tools/nip19";

import type { CommunityMemberModel } from "../community-workspace/model.js";
import {
  bundleMessageRowMembers,
  implicitTaggedMentionMembers,
  taggedMentionAvatarsLabel,
} from "./implicit-mentions.js";

const fizzId = "a".repeat(64);
const honeyId = "b".repeat(64);
const ada: CommunityMemberModel = {
  id: "ada",
  name: "Ada Lovelace",
  handle: "ada",
  initials: "AL",
};
const fizz: CommunityMemberModel = {
  id: fizzId,
  name: "Fizz",
  handle: "fizz",
  initials: "FZ",
  kind: "agent",
};
const honey: CommunityMemberModel = {
  id: honeyId,
  name: "BHoney",
  handle: "honey",
  initials: "HY",
  kind: "agent",
};

describe("implicitTaggedMentionMembers", () => {
  it("returns tagged agents missing from the body", () => {
    expect(
      implicitTaggedMentionMembers(
        {
          authorId: "ben",
          content: "please continue",
          mentionPubkeys: [fizzId, honeyId],
        },
        [ada, fizz, honey],
      ),
    ).toEqual([fizz, honey]);
  });

  it("hides members already named in the body", () => {
    expect(
      implicitTaggedMentionMembers(
        {
          authorId: "ben",
          content: `@Fizz nostr:${npubEncode(honeyId)} keep going`,
          mentionPubkeys: [fizzId, honeyId, ada.id],
        },
        [ada, fizz, honey],
      ),
    ).toEqual([ada]);
  });

  it("omits the author, unknown pubkeys, and activity messages", () => {
    expect(
      implicitTaggedMentionMembers(
        {
          authorId: fizzId,
          content: "status update",
          mentionPubkeys: [fizzId, "c".repeat(64)],
        },
        [fizz],
      ),
    ).toEqual([]);
    expect(
      implicitTaggedMentionMembers(
        {
          activity: { type: "channel-created" },
          authorId: "ben",
          content: "created the channel",
          mentionPubkeys: [fizzId],
        },
        [fizz],
      ),
    ).toEqual([]);
  });

  it("keeps reply-parent people off the row and still shows agents", () => {
    expect(
      implicitTaggedMentionMembers(
        {
          authorId: "ben",
          content: "following up",
          mentionPubkeys: [ada.id, fizzId],
          parentMessageId: "message-root",
        },
        [ada, fizz],
      ),
    ).toEqual([fizz]);
  });
});

describe("bundleMessageRowMembers", () => {
  it("adds missing tags to the reply avatars and drops duplicates", () => {
    expect(bundleMessageRowMembers([ada, fizz], [fizz, honey])).toEqual([
      honey,
      ada,
      fizz,
    ]);
  });

  it("keeps tagged members visible when the reply stack is already full", () => {
    expect(bundleMessageRowMembers([ada, fizz, honey], [honey])).toEqual([
      ada,
      fizz,
      honey,
    ]);
    expect(bundleMessageRowMembers([ada, honey], [fizz])).toEqual([
      fizz,
      ada,
      honey,
    ]);
  });
});

describe("taggedMentionAvatarsLabel", () => {
  it("names the tagged members", () => {
    expect(taggedMentionAvatarsLabel([fizz])).toBe("Tagged Fizz");
    expect(taggedMentionAvatarsLabel([fizz, honey])).toBe(
      "Tagged Fizz and BHoney",
    );
    expect(taggedMentionAvatarsLabel([fizz, honey, ada])).toBe(
      "Tagged Fizz, BHoney, and Ada Lovelace",
    );
  });
});
