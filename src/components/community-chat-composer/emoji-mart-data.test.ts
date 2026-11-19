import { describe, expect, it } from "vitest";
import { init, SearchIndex } from "emoji-mart";

import { loadEmojiMartData } from "./emoji-mart-data.js";

describe("emoji-mart data loader", () => {
  it("loads data that initializes the standard search index", async () => {
    const data = await loadEmojiMartData();
    await init({ data });
    const results = (await SearchIndex.search("rock", {
      caller: "emoji-mart-data",
      maxResults: 24,
    })) as Array<{ id: string }> | null;
    expect(results?.some((emoji) => emoji.id === "rocket")).toBe(true);
  });
});
