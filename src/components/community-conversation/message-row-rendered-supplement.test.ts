import { expect, it } from "vitest";
import { estimateCommunityMessageRow } from "./message-row-estimate.js";

it("adds the rendered divider or transcript height instead of a fixed supplement", () => {
  const message = { id: "a", content: "A short channel message" };
  const plain = estimateCommunityMessageRow(message);

  expect(estimateCommunityMessageRow(message, { supplementHeight: 54 })).toBe(
    plain + 54,
  );
  expect(
    estimateCommunityMessageRow(message, { supplementHeight: 1_008 }),
  ).toBe(plain + 1_008);
});
