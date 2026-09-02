import { describe, expect, it } from "vitest";

import { communityNavigationFixture } from "./story-fixtures.js";
import { filterCommunityNavigation } from "./model.js";

describe("community navigation", () => {
  it("filters supported destinations without mutating the fixture", () => {
    const filtered = filterCommunityNavigation(
      communityNavigationFixture,
      "release",
    );

    expect(filtered.primaryItems).toEqual([]);
    expect(filtered.sections).toHaveLength(1);
    expect(filtered.sections[0]?.label).toBe("Channels");
    expect(filtered.sections[0]?.items.map((item) => item.id)).toEqual([
      "plugin-releases",
    ]);
    expect(communityNavigationFixture.sections).toHaveLength(3);
  });

  it("retains empty supported sections when no search is active", () => {
    expect(filterCommunityNavigation(communityNavigationFixture, "")).toBe(
      communityNavigationFixture,
    );
    expect(
      communityNavigationFixture.sections.find(
        (section) => section.id === "direct-messages",
      )?.items,
    ).toEqual([]);
  });

  it("provides Inbox and controlled actions for every room section", () => {
    expect(communityNavigationFixture.primaryItems[0]).toMatchObject({
      id: "inbox",
      kind: "inbox",
    });
    expect(
      communityNavigationFixture.sections.map((section) => [
        section.id,
        section.actions?.length,
      ]),
    ).toEqual([
      ["channels", 2],
      ["forums", 2],
      ["direct-messages", 1],
    ]);
  });
});
