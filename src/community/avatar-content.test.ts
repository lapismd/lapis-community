import { describe, expect, it } from "vitest";

import {
  communityMemberAvatarContent,
  communityStoredAvatar,
  isCommunityAvatarEmoji,
  isCommunityAvatarImage,
} from "./avatar-content.js";

describe("community member avatar content", () => {
  it("prefers an image URL over emoji or initials", () => {
    expect(
      communityMemberAvatarContent({
        avatarUrl: "https://example.test/nyra.png",
        initials: "NY",
      }),
    ).toEqual({ kind: "image", src: "https://example.test/nyra.png" });
    expect(
      isCommunityAvatarImage(
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E",
      ),
    ).toBe(true);
  });

  it("renders a stored emoji when there is no image", () => {
    expect(
      communityMemberAvatarContent({ avatarUrl: "🧭", initials: "NY" }),
    ).toEqual({ kind: "emoji", emoji: "🧭" });
    expect(isCommunityAvatarEmoji("🦊")).toBe(true);
    expect(communityStoredAvatar("✨")).toBe("✨");
  });

  it("falls back to initials when neither image nor emoji is available", () => {
    expect(communityMemberAvatarContent({ initials: "NY" })).toEqual({
      kind: "initials",
      initials: "NY",
    });
    expect(communityStoredAvatar("not-an-avatar")).toBeUndefined();
    expect(communityStoredAvatar("https://example.test/ada.png")).toBe(
      "https://example.test/ada.png",
    );
  });
});
