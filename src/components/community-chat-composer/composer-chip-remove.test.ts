import { describe, expect, it } from "vitest";

import { composerChipRemovalRange } from "./composer-chip-remove.js";

describe("composerChipRemovalRange", () => {
  it("deletes a token and one following space", () => {
    expect(composerChipRemovalRange("hello token world", 6, 11)).toEqual({
      from: 6,
      to: 12,
    });
  });

  it("leaves punctuation after the token", () => {
    expect(composerChipRemovalRange("token.", 0, 5)).toEqual({
      from: 0,
      to: 5,
    });
  });

  it("deletes a token at the end of the draft", () => {
    expect(composerChipRemovalRange("token", 0, 5)).toEqual({
      from: 0,
      to: 5,
    });
  });
});
