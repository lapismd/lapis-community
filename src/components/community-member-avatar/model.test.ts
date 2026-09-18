import { describe, expect, it } from "vitest";

import { communityMemberHandleLabel } from "./handle.js";
import {
  communityMemberAvatarFallbackTone,
  communityMemberAvatarFallbackTones,
} from "./model.js";

describe("community member avatar fallback tone", () => {
  it("matches Buzz's display-name palette selection", () => {
    expect(communityMemberAvatarFallbackTone("Ada Lovelace")).toBe("blue");
    expect(communityMemberAvatarFallbackTone("Ben Stone")).toBe("rose");
    expect(communityMemberAvatarFallbackTone("Cy Park")).toBe("violet");
    expect(communityMemberAvatarFallbackTone("BFizz")).toBe("emerald");
    expect(communityMemberAvatarFallbackTone("Steve Juma")).toBe("cyan");
  });

  it("normalizes whitespace and letter case before hashing", () => {
    expect(communityMemberAvatarFallbackTone("  BFiZZ  ")).toBe(
      communityMemberAvatarFallbackTone("bfizz"),
    );
  });

  it("always returns one of the supported tones", () => {
    expect(communityMemberAvatarFallbackTones).toContain(
      communityMemberAvatarFallbackTone("🧭 Relay Guide"),
    );
  });
});

describe("community member handle label", () => {
  it("adds a single @ and strips stored prefixes", () => {
    expect(communityMemberHandleLabel("maya")).toBe("@maya");
    expect(communityMemberHandleLabel("@maya")).toBe("@maya");
    expect(communityMemberHandleLabel("@@maya")).toBe("@maya");
    expect(communityMemberHandleLabel("  @noor  ")).toBe("@noor");
    expect(communityMemberHandleLabel("")).toBe("");
  });
});
