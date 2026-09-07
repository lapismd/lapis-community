import { describe, expect, it, vi } from "vitest";

import {
  buildCommunityGroupInvite,
  createCommunityInviteCode,
  parseCommunityGroupInvite,
} from "./group-invites.js";

describe("Community group invites", () => {
  it("round-trips canonical NIP-29 invite URIs", () => {
    const invite = buildCommunityGroupInvite({
      groupId: "private-design",
      relayUrl: "wss://relay.example",
      relayPubkey: "ab".repeat(32),
      code: "invite-code",
    });

    expect(parseCommunityGroupInvite(invite.uri)).toEqual(invite);
    expect(
      parseCommunityGroupInvite(invite.uri.slice("nostr:".length)),
    ).toEqual(invite);
  });

  it("rejects malformed, non-group, and relay-less values", () => {
    expect(() => parseCommunityGroupInvite("not-an-invite")).toThrow(
      "valid NIP-29 invite link",
    );
    expect(() =>
      parseCommunityGroupInvite(
        buildCommunityGroupInvite({
          groupId: "private-design",
          relayUrl: "wss://relay.example",
          relayPubkey: "ab".repeat(32),
          code: "invite-code",
        }).uri.replace("invite=invite-code", "other=value"),
      ),
    ).toThrow("Invite code is required");
  });

  it("creates 128-bit random invite codes", () => {
    const getRandomValues = vi
      .spyOn(globalThis.crypto, "getRandomValues")
      .mockImplementation((array) => {
        (array as Uint8Array).fill(0xab);
        return array;
      });

    expect(createCommunityInviteCode()).toBe("ab".repeat(16));
    getRandomValues.mockRestore();
  });
});
