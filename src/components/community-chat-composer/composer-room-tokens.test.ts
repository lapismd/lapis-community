import { describe, expect, it } from "vitest";

import { communityRoomAutocompleteItems } from "./autocomplete.js";
import {
  composerRoomReferenceTokens,
  composerTokenRoom,
} from "./composer-room-tokens.js";

const rooms = [
  { id: "general", name: "general", kind: "channel" as const },
  { id: "ideas", name: "plugin-ideas", kind: "forum" as const },
  { id: "dm", name: "Ada", kind: "direct" as const },
  { id: "old", name: "old", kind: "channel" as const, archived: true },
];

describe("composer room tokens", () => {
  it("maps public rooms to hash tokens with room ids", () => {
    expect(composerRoomReferenceTokens(rooms)).toEqual([
      { token: "#general", kind: "channel", roomId: "general" },
      { token: "#plugin-ideas", kind: "channel", roomId: "ideas" },
    ]);
  });

  it("resolves a room id from the composer room list", () => {
    expect(composerTokenRoom("ideas", rooms)?.kind).toBe("forum");
    expect(composerTokenRoom("missing", rooms)).toBeUndefined();
  });

  it("omits Forum and Channel detail from hash picker rows", () => {
    expect(
      communityRoomAutocompleteItems(rooms, "").map((item) => item.detail),
    ).toEqual([undefined, undefined]);
  });
});
