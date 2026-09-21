import { describe, expect, it } from "vitest";
import { npubEncode } from "nostr-tools/nip19";

import {
  communityComposerAutocompleteInsert,
  communityComposerMentionInsert,
} from "./composer-mention-insert.js";

const agent = "a".repeat(64);
const human = "b".repeat(64);

describe("composer mention insert", () => {
  it("inserts a NIP-27 token for a colliding display name", () => {
    expect(communityComposerMentionInsert({ id: agent, name: "Nyra" })).toBe(
      `nostr:${npubEncode(agent)} `,
    );
    expect(communityComposerMentionInsert({ id: human, name: "Nyra" })).toBe(
      `nostr:${npubEncode(human)} `,
    );
  });

  it("keeps @Name only when the member id is not a pubkey", () => {
    expect(
      communityComposerMentionInsert({ id: "ada", name: "Ada Lovelace" }),
    ).toBe("@Ada Lovelace ");
  });

  it("uses the NIP-27 insert for autocomplete member picks", () => {
    expect(
      communityComposerAutocompleteInsert({
        id: `member:${agent}`,
        kind: "member",
        label: "Nyra",
        member: {
          id: agent,
          name: "Nyra",
          handle: "nyra",
          initials: "NY",
          kind: "agent",
        },
      }),
    ).toBe(`nostr:${npubEncode(agent)} `);
  });
});
