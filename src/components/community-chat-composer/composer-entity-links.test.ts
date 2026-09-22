import { describe, expect, it } from "vitest";

import { isSafeCommunityLink } from "./model.js";
import {
  communityComposerEntityMatches,
  normalizedCommunityPasteHref,
} from "./composer-entity-links.js";

const eventId = "c".repeat(64);
const href = `lapis-community://message?channel=general&id=${eventId}`;

describe("composer entity links", () => {
  it("accepts lapis-community URIs as safe links", () => {
    expect(isSafeCommunityLink(href)).toBe(true);
  });

  it("normalizes pasted hashes and absolute URLs to the scheme", () => {
    expect(normalizedCommunityPasteHref("#/channels/general")).toBe(
      "lapis-community://channel/general",
    );
    expect(
      normalizedCommunityPasteHref(
        "https://local-community.lapis.md/#/channels/general",
      ),
    ).toBe("lapis-community://channel/general");
    expect(normalizedCommunityPasteHref(href)).toBeUndefined();
  });

  it("finds entity tokens in composer text", () => {
    expect(communityComposerEntityMatches(`see ${href}`)).toEqual([
      { from: 4, to: 4 + href.length, href, link: expect.any(Object) },
    ]);
  });
});
