import { describe, expect, it } from "vitest";

import {
  loadOwnersFromBlob,
  ownersForPath,
  parseOwnersDocument,
} from "./owners.js";

describe("OWNERS.md", () => {
  it("uses the longest matching path and fails closed", () => {
    const owner = "1".repeat(64);
    const docs = "2".repeat(64);
    const document = parseOwnersDocument(`# comment\n* ${owner}\ndocs/ ${docs}\n`);
    expect(ownersForPath(document, "README.md")).toEqual([owner]);
    expect(ownersForPath(document, "docs/guide.md")).toEqual([docs]);
    expect(parseOwnersDocument("* not-a-key").rules).toEqual([]);
  });

  it("loads a protected-tip OWNERS.md blob and ignores missing files", async () => {
    const owner = "1".repeat(64);
    await expect(
      loadOwnersFromBlob(async () => ({ contents: `* ${owner}\n` })),
    ).resolves.toEqual({ rules: [{ path: "*", pubkeys: [owner] }] });
    await expect(
      loadOwnersFromBlob(async () => {
        throw new Error("not found");
      }),
    ).resolves.toBeUndefined();
  });
});
