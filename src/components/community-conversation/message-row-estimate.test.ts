import { describe, expect, it } from "vitest";
import { estimateCommunityMessageRow } from "./message-row-estimate.js";

describe("estimateCommunityMessageRow", () => {
  it("estimates short and long messages differently", () => {
    const short = estimateCommunityMessageRow({ id: "a", content: "Hi" });
    const long = estimateCommunityMessageRow({
      id: "b",
      content: "Long message ".repeat(80),
    });
    expect(long).toBeGreaterThan(short);
  });

  it("uses a smaller estimate for continuation rows", () => {
    const base = { id: "a", content: "Continuation candidate" };
    expect(
      estimateCommunityMessageRow(base, { continuation: true }),
    ).toBeLessThan(estimateCommunityMessageRow(base));
  });

  it("accounts for reactions, replies, supplements and code blocks", () => {
    const plain = estimateCommunityMessageRow({ id: "a", content: "Patch" });
    const rich = estimateCommunityMessageRow(
      {
        id: "b",
        content: "```ts\nconst value = 1;\n```",
        reactions: [{ emoji: "👍", count: 2 }],
        replyCount: 3,
      },
      { hasSupplement: true },
    );
    expect(rich).toBeGreaterThan(plain + 120);
  });

  it("keeps activity and malformed messages bounded", () => {
    expect(
      estimateCommunityMessageRow({
        id: "activity",
        content: "",
        activity: { type: "member-joined" },
      }),
    ).toBeLessThan(70);
    expect(estimateCommunityMessageRow(undefined)).toBeGreaterThan(40);
  });
});
