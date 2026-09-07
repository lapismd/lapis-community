import { describe, expect, it } from "vitest";

import {
  COMMUNITY_APPLICATION_DESTINATION_STORAGE_KEY,
  COMMUNITY_APPLICATION_RELEASE_OVERVIEW_PANEL_ID,
  COMMUNITY_APPLICATION_SHELL_LAYOUT_STORAGE_KEY,
  createCommunityApplicationHistory,
  currentCommunityApplicationLocation,
  loadCommunityApplicationDestination,
  loadCommunityApplicationInitialShellLayout,
  moveCommunityApplicationHistory,
  noCommunityApplicationPanel,
  normalizeCommunityApplicationLocation,
  pushCommunityApplicationLocation,
  replaceCommunityApplicationLocation,
  saveCommunityApplicationDestination,
  type CommunityApplicationHistory,
  type CommunityApplicationLocation,
} from "./navigation.js";

const location = (
  destination: string,
  panel: CommunityApplicationLocation["panel"] = noCommunityApplicationPanel(),
  mainSurface?: CommunityApplicationLocation["mainSurface"],
): CommunityApplicationLocation => ({
  destination,
  panel,
  ...(mainSurface === undefined ? {} : { mainSurface }),
});

const push = (
  history: CommunityApplicationHistory,
  next: CommunityApplicationLocation,
): CommunityApplicationHistory =>
  pushCommunityApplicationLocation(history, next);

describe("Community application location history", () => {
  it("prehydrates the shell from a valid persisted layout", () => {
    const storage = {
      getItem: (key: string) =>
        key === COMMUNITY_APPLICATION_SHELL_LAYOUT_STORAGE_KEY
          ? JSON.stringify({
              version: 1,
              panels: {
                left: {
                  side: "left",
                  collapsed: false,
                  closed: false,
                  width: 336,
                },
                right: {
                  side: "right",
                  collapsed: true,
                  closed: true,
                  width: 360,
                },
                [COMMUNITY_APPLICATION_RELEASE_OVERVIEW_PANEL_ID]: {
                  side: "right",
                  collapsed: false,
                  closed: false,
                  width: 304,
                },
              },
            })
          : null,
    };

    expect(loadCommunityApplicationInitialShellLayout(storage)).toEqual({
      left: {
        side: "left",
        collapsed: false,
        closed: false,
        width: 336,
      },
      right: {
        side: "right",
        collapsed: true,
        closed: true,
        width: 360,
      },
      releaseOverview: {
        side: "right",
        collapsed: false,
        closed: false,
        width: 304,
      },
    });
  });

  it.each([
    "not json",
    JSON.stringify({ version: 2, panels: {} }),
    JSON.stringify({ version: 1, panels: [] }),
    JSON.stringify({
      version: 1,
      panels: {
        left: { side: "right", collapsed: false, closed: false },
      },
    }),
  ])("ignores an invalid persisted shell layout", (serialized) => {
    expect(
      loadCommunityApplicationInitialShellLayout({
        getItem: () => serialized,
      }),
    ).toEqual({});
  });

  it("persists only the current destination for refresh restoration", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    saveCommunityApplicationDestination(storage, "registry:plugin:ai");

    expect(values.get(COMMUNITY_APPLICATION_DESTINATION_STORAGE_KEY)).toBe(
      JSON.stringify({
        version: 1,
        destination: "registry:plugin:ai",
      }),
    );
    expect(loadCommunityApplicationDestination(storage)).toBe(
      "registry:plugin:ai",
    );
  });

  it.each([
    "not json",
    JSON.stringify({ version: 2, destination: "registry" }),
    JSON.stringify({ version: 1, destination: "" }),
    JSON.stringify({ version: 1, destination: " registry" }),
    JSON.stringify({ version: 1, destination: "registry\n" }),
  ])("ignores an invalid persisted destination snapshot", (serialized) => {
    expect(
      loadCommunityApplicationDestination({
        getItem: () => serialized,
        setItem: () => undefined,
      }),
    ).toBeNull();
  });

  it("fails open when browser destination storage is unavailable", () => {
    const storage = {
      getItem: () => {
        throw new Error("Storage is unavailable");
      },
      setItem: () => {
        throw new Error("Storage is unavailable");
      },
    };

    expect(loadCommunityApplicationDestination(storage)).toBeNull();
    expect(() =>
      saveCommunityApplicationDestination(storage, "registry"),
    ).not.toThrow();
  });

  it("records panel opening, replacement, and closing as exclusive states", () => {
    let history = createCommunityApplicationHistory("general");
    history = push(
      history,
      location("general", { kind: "details", roomId: "general" }),
    );
    history = push(
      history,
      location("general", {
        kind: "thread",
        roomId: "general",
        rootMessageId: "root",
      }),
    );
    history = push(
      history,
      location("general", { kind: "profile", memberId: "steve" }),
    );
    history = push(history, location("general"));

    expect(history.entries.map(({ panel }) => panel.kind)).toEqual([
      "none",
      "details",
      "thread",
      "profile",
      "none",
    ]);

    history = moveCommunityApplicationHistory(history, -1);
    expect(currentCommunityApplicationLocation(history).panel).toEqual({
      kind: "profile",
      memberId: "steve",
    });
  });

  it("scopes panels to their page and restores them with Back and Forward", () => {
    let history = createCommunityApplicationHistory("general");
    history = push(
      history,
      location("general", {
        kind: "thread",
        roomId: "general",
        rootMessageId: "root",
        replyTargetId: "reply",
      }),
    );
    history = push(history, location("registry"));

    expect(currentCommunityApplicationLocation(history)).toEqual(
      location("registry"),
    );
    history = moveCommunityApplicationHistory(history, -1);
    expect(currentCommunityApplicationLocation(history)).toEqual(
      location("general", {
        kind: "thread",
        roomId: "general",
        rootMessageId: "root",
        replyTargetId: "reply",
      }),
    );
    history = moveCommunityApplicationHistory(history, 1);
    expect(currentCommunityApplicationLocation(history)).toEqual(
      location("registry"),
    );
  });

  it("records release sheets independently from the exclusive right panel", () => {
    let history = createCommunityApplicationHistory("plugin-releases");
    history = push(
      history,
      location(
        "plugin-releases",
        noCommunityApplicationPanel(),
        "release-reviews",
      ),
    );
    history = push(
      history,
      location(
        "plugin-releases",
        { kind: "profile", memberId: "steve" },
        "release-reviews",
      ),
    );

    expect(history.entries).toEqual([
      location("plugin-releases"),
      location(
        "plugin-releases",
        noCommunityApplicationPanel(),
        "release-reviews",
      ),
      location(
        "plugin-releases",
        { kind: "profile", memberId: "steve" },
        "release-reviews",
      ),
    ]);

    history = moveCommunityApplicationHistory(history, -1);
    expect(currentCommunityApplicationLocation(history)).toEqual(
      location(
        "plugin-releases",
        noCommunityApplicationPanel(),
        "release-reviews",
      ),
    );
  });

  it("ignores duplicates and truncates forward history after a new transition", () => {
    let history = createCommunityApplicationHistory("general");
    const details = location("general", { kind: "details", roomId: "general" });
    history = push(history, details);
    expect(push(history, details)).toBe(history);

    history = moveCommunityApplicationHistory(history, -1);
    history = push(history, location("registry"));
    expect(history.entries).toEqual([
      location("general"),
      location("registry"),
    ]);
    expect(moveCommunityApplicationHistory(history, 1)).toBe(history);
  });

  it("replaces an invalid restored target without adding navigation history", () => {
    let history = createCommunityApplicationHistory("general");
    history = push(
      history,
      location("general", { kind: "profile", memberId: "missing" }),
    );

    history = replaceCommunityApplicationLocation(history, location("general"));

    expect(history.index).toBe(1);
    expect(history.entries).toEqual([location("general"), location("general")]);
  });

  it.each([
    location("general", { kind: "details", roomId: "missing" }),
    location("general", {
      kind: "thread",
      roomId: "general",
      rootMessageId: "missing",
    }),
    location("general", { kind: "profile", memberId: "missing" }),
  ])("normalizes missing panel targets to no panel", (candidate) => {
    expect(
      normalizeCommunityApplicationLocation(candidate, {
        roomIds: ["general"],
        memberIds: ["steve"],
        messageIds: ["root", "reply"],
      }),
    ).toEqual(location("general"));
  });

  it("normalizes release sheets outside the canonical release room", () => {
    expect(
      normalizeCommunityApplicationLocation(
        location("general", noCommunityApplicationPanel(), "release-people"),
        {
          roomIds: ["general", "plugin-releases"],
          memberIds: ["steve"],
          releaseRoomIds: ["plugin-releases"],
        },
      ),
    ).toEqual(location("general"));
  });

  it("retains release sheets for the canonical release room", () => {
    const candidate = location(
      "plugin-releases",
      noCommunityApplicationPanel(),
      "release-reviews",
    );
    expect(
      normalizeCommunityApplicationLocation(candidate, {
        roomIds: ["plugin-releases"],
        memberIds: ["steve"],
        releaseRoomIds: ["plugin-releases"],
      }),
    ).toBe(candidate);
  });

  it("keeps a destination and its details panel in one composite entry", () => {
    let history = createCommunityApplicationHistory("registry");
    history = push(
      history,
      location("general", { kind: "details", roomId: "general" }),
    );

    expect(history.entries).toHaveLength(2);
    expect(currentCommunityApplicationLocation(history)).toEqual(
      location("general", { kind: "details", roomId: "general" }),
    );
  });
});
