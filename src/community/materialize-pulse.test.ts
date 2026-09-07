import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
import { describe, expect, it } from "vitest";

import type { NostrEventTemplate } from "../protocol/index.js";
import { materializeCommunityPulse } from "./materialize-pulse.js";

const authorKey = new Uint8Array(32).fill(11);
const readerKey = new Uint8Array(32).fill(12);
const otherKey = new Uint8Array(32).fill(13);

function signed(key: Uint8Array, template: NostrEventTemplate) {
  return finalizeEvent(template, key);
}

describe("materializeCommunityPulse", () => {
  it("verifies, orders, enriches, and filters public notes deterministically", () => {
    const author = getPublicKey(authorKey);
    const reader = getPublicKey(readerKey);
    const other = getPublicKey(otherKey);
    const parent = signed(authorKey, {
      kind: 1,
      created_at: 100,
      content: "A parent note",
      tags: [],
    });
    const reply = signed(otherKey, {
      kind: 1,
      created_at: 110,
      content: "A reply",
      tags: [
        ["e", parent.id, "", "reply"],
        ["p", author],
      ],
    });
    const projectComment = signed(authorKey, {
      kind: 1,
      created_at: 120,
      content: "Not part of Pulse",
      tags: [["a", `30617:${author}:issue`]],
    });
    const profile = signed(authorKey, {
      kind: 0,
      created_at: 90,
      content: JSON.stringify({ display_name: "Ada", name: "ada" }),
      tags: [],
    });
    const authorLike = signed(authorKey, {
      kind: 7,
      created_at: 111,
      content: "+",
      tags: [["e", reply.id]],
    });
    const readerLike = signed(readerKey, {
      kind: 7,
      created_at: 112,
      content: "+",
      tags: [["e", reply.id]],
    });
    const unlike = signed(authorKey, {
      kind: 5,
      created_at: 113,
      content: "",
      tags: [["e", authorLike.id]],
    });
    const invalid = { ...parent, content: "tampered" };

    const model = materializeCommunityPulse(
      [
        invalid,
        reply,
        parent,
        reply,
        projectComment,
        profile,
        authorLike,
        readerLike,
        unlike,
      ],
      {
        tab: "everyone",
        primaryEventIds: [projectComment.id, reply.id, parent.id],
        identityPubkey: reader,
        asOf: 200,
      },
    );

    expect(model.notes.map((note) => note.id)).toEqual([reply.id, parent.id]);
    expect(model.notes[0]).toMatchObject({
      content: "A reply",
      likeCount: 1,
      likedByCurrentUser: true,
      parent: { id: parent.id, content: "A parent note" },
    });
    expect(model.notes[0]?.parent?.author.name).toBe("Ada");
    expect(model.members.map((member) => member.id)).toEqual(
      expect.arrayContaining([author, other]),
    );
  });

  it("groups consecutive activity for a supplied agent within five minutes", () => {
    const author = getPublicKey(authorKey);
    const notes = [
      signed(authorKey, {
        kind: 1,
        created_at: 1_000,
        content: "one",
        tags: [],
      }),
      signed(authorKey, { kind: 1, created_at: 800, content: "two", tags: [] }),
      signed(authorKey, {
        kind: 1,
        created_at: 400,
        content: "three",
        tags: [],
      }),
    ];
    const model = materializeCommunityPulse(notes, {
      tab: "agents",
      primaryEventIds: notes.map((note) => note.id),
      agents: [{ pubkey: author, name: "Pollen", status: "Working" }],
      asOf: 1_100,
    });

    expect(model.agentActivities).toHaveLength(2);
    expect(model.agentActivities[0]?.notes).toHaveLength(2);
    expect(model.agentActivities[0]?.agent.name).toBe("Pollen");
    expect(model.agentActivities[1]?.notes[0]?.content).toBe("three");
  });
});
