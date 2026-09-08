import { describe, expect, it } from "vitest";

import { communityNavigationFixture } from "./story-fixtures.js";
import {
  communityNavigationSectionKind,
  filterCommunityNavigation,
  withStarredCommunityNavigationSection,
} from "./model.js";

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
        Number(Boolean(section.primaryAction)) + (section.actions?.length ?? 0),
      ]),
    ).toEqual([
      ["channels", 2],
      ["forums", 2],
      ["direct-messages", 1],
    ]);
  });

  it("resolves standard and custom section kinds without requiring consumers to migrate", () => {
    expect(
      communityNavigationFixture.sections.map((section) =>
        communityNavigationSectionKind(section),
      ),
    ).toEqual(["channels", "forums", "direct-messages"]);
    expect(
      communityNavigationSectionKind({
        id: "projects",
        label: "Projects",
        items: [],
      }),
    ).toBe("projects");
  });

  it("keeps a project parent when one of its attached channels matches", () => {
    const model = {
      primaryItems: [],
      sections: [
        {
          id: "projects",
          label: "Projects",
          kind: "projects" as const,
          items: [
            {
              id: "projects/community",
              label: "Community",
              kind: "projects" as const,
              children: [
                { id: "general", label: "#general", kind: "channel" as const },
              ],
            },
          ],
        },
      ],
    };

    expect(
      filterCommunityNavigation(model, "general").sections[0]?.items,
    ).toEqual([
      {
        ...model.sections[0]!.items[0],
        children: model.sections[0]!.items[0]!.children,
      },
    ]);
  });

  it("prepends unique starred channel and forum shortcuts while retaining originals", () => {
    const directMessage = {
      id: "dm",
      label: "Member",
      kind: "direct-message" as const,
      starred: true,
    };
    const channel = {
      id: "general",
      label: "general",
      kind: "channel" as const,
      starred: true,
    };
    const forum = {
      id: "support",
      label: "support",
      kind: "forum" as const,
      starred: true,
    };
    const sections = withStarredCommunityNavigationSection([
      { id: "channels", label: "Channels", items: [channel] },
      { id: "forums", label: "Forums", items: [forum, channel] },
      {
        id: "direct-messages",
        label: "Direct messages",
        items: [directMessage],
      },
    ]);

    expect(sections[0]).toMatchObject({
      id: "starred",
      kind: "starred",
      items: [channel, forum],
    });
    expect(sections[1]?.items).toContain(channel);
    expect(sections[2]?.items).toContain(forum);
    expect(sections[0]?.items).not.toContain(directMessage);
  });

  it("omits an empty starred section", () => {
    const sections = [
      {
        id: "channels",
        label: "Channels",
        items: [{ id: "general", label: "general", kind: "channel" as const }],
      },
    ];

    expect(withStarredCommunityNavigationSection(sections)).toEqual(sections);
  });
});
