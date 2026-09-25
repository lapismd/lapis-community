import { describe, expect, it } from "vitest";

import {
  COMMUNITY_APPLICATION_DESTINATION_STORAGE_KEY,
  COMMUNITY_APPLICATION_RELEASE_OVERVIEW_PANEL_ID,
  COMMUNITY_APPLICATION_SHELL_LAYOUT_STORAGE_KEY,
  createCommunityApplicationHistory,
  currentCommunityApplicationLocation,
  loadCommunityApplicationDestination,
  loadCommunityApplicationLocation,
  loadCommunityApplicationInitialShellLayout,
  moveCommunityApplicationHistory,
  noCommunityApplicationPanel,
  normalizeCommunityApplicationLocation,
  pushCommunityApplicationLocation,
  agentLocationFromHash,
  agentLocationToHash,
  projectRouteFromHash,
  projectRouteToHash,
  replaceCommunityApplicationLocation,
  saveCommunityApplicationDestination,
  saveCommunityApplicationLocation,
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
  it("restores exact agent topic and turn from a shareable route", () => {
    const expected = location("agents", {
      kind: "agent-activity",
      agentPubkey: "ab".repeat(32),
      channelId: "general",
      activityContext: {
        kind: "forum-topic",
        channelId: "general",
        threadRootId: "cd".repeat(32),
        focusTurnId: "turn-1",
      },
    });
    expect(agentLocationFromHash(agentLocationToHash(expected)!)).toEqual(
      expected,
    );
  });
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

  it("persists the current destination for refresh restoration", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    saveCommunityApplicationDestination(storage, "registry:plugin:ai");

    expect(values.get(COMMUNITY_APPLICATION_DESTINATION_STORAGE_KEY)).toBe(
      JSON.stringify({
        version: 2,
        destination: "registry:plugin:ai",
      }),
    );
    expect(loadCommunityApplicationDestination(storage)).toBe(
      "registry:plugin:ai",
    );
  });

  it("persists project and repository surfaces with a v1 fallback", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const saved = location(
      "projects/30621%3Aowner%3Aroadmap",
      noCommunityApplicationPanel(),
      "project-files",
    );
    saved.projectRoute = {
      kind: "project",
      coordinate: "30621:owner:roadmap",
      surface: "files",
    };
    saveCommunityApplicationLocation(storage, saved);
    expect(loadCommunityApplicationLocation(storage)).toEqual(saved);

    values.set(
      COMMUNITY_APPLICATION_DESTINATION_STORAGE_KEY,
      JSON.stringify({ version: 1, destination: "registry" }),
    );
    expect(loadCommunityApplicationLocation(storage)).toEqual(
      location("registry"),
    );
  });

  it("round trips durable project and repository hashes", () => {
    expect(
      projectRouteToHash({
        kind: "repository",
        coordinate: "30617:owner:community",
        surface: "log",
      }),
    ).toBe("#/projects/repository/30617:owner:community/log");
    expect(
      projectRouteToHash({
        kind: "project",
        coordinate: "30621:owner:road map",
        surface: "activity",
      }),
    ).toBe("#/projects/project/30621:owner:road%20map");
    expect(
      projectRouteFromHash(
        "#/projects/repository/30617%3Aowner%3Acommunity/log",
      ),
    ).toEqual({
      kind: "repository",
      coordinate: "30617:owner:community",
      surface: "log",
    });
    for (const route of [
      {
        kind: "project" as const,
        coordinate: "30621:owner:road map",
        surface: "activity" as const,
      },
      {
        kind: "repository" as const,
        coordinate: "30617:owner:community",
        surface: "commits" as const,
      },
    ]) {
      expect(projectRouteFromHash(projectRouteToHash(route))).toEqual(route);
    }
    expect(
      projectRouteFromHash("#/projects/project/bad/files/extra/ "),
    ).toBeNull();
    expect(
      projectRouteFromHash("#/projects/project/value/not-a-surface"),
    ).toBeNull();
  });

  it.each([
    "not json",
    JSON.stringify({ version: 3, destination: "registry" }),
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

  it("retains project sheets over verified project channels", () => {
    const candidate = location(
      "general",
      noCommunityApplicationPanel(),
      "project-tasks",
    );
    expect(
      normalizeCommunityApplicationLocation(candidate, {
        roomIds: ["general"],
        memberIds: ["steve"],
        projectChannelDestinationIds: ["general"],
      }),
    ).toBe(candidate);
    expect(
      normalizeCommunityApplicationLocation(candidate, {
        roomIds: ["general"],
        memberIds: ["steve"],
        projectChannelDestinationIds: [],
      }),
    ).toEqual(location("general"));
  });

  it("preserves a project route while its catalog target is unresolved", () => {
    const candidate: CommunityApplicationLocation = {
      destination: "projects/30621%3Aowner%3Aroadmap",
      panel: noCommunityApplicationPanel(),
      mainSurface: "project-files",
      projectRoute: {
        kind: "project",
        coordinate: "30621:owner:roadmap",
        surface: "files",
      },
    };

    expect(
      normalizeCommunityApplicationLocation(candidate, {
        roomIds: [],
        memberIds: [],
        projectDestinationIds: [],
      }),
    ).toEqual({
      destination: candidate.destination,
      panel: noCommunityApplicationPanel(),
      projectRoute: candidate.projectRoute,
    });
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

describe("agent navigation", () => {
  const agent = "a".repeat(64);
  it("roundtrips gallery, profile, activity, and escaped channel filters", () => {
    for (const next of [
      location("agents"),
      location("agents", { kind: "profile", memberId: agent }),
      location("agents", {
        kind: "agent-activity",
        agentPubkey: agent,
        channelId: "research / plans",
      }),
    ]) {
      expect(agentLocationFromHash(agentLocationToHash(next)!)).toEqual(next);
    }
    expect(agentLocationFromHash("#/agents?agent=forged")).toBeNull();
    expect(
      agentLocationFromHash(`#/agents?agent=${agent}&channel=%00`),
    ).toBeNull();
  });
  it("preserves archived agent panels and closes unavailable ones", () => {
    const next = location("agents", {
      kind: "agent-activity",
      agentPubkey: agent,
    });
    expect(
      normalizeCommunityApplicationLocation(next, {
        roomIds: [],
        memberIds: [],
        agentIds: [agent],
      }),
    ).toEqual(next);
    expect(
      normalizeCommunityApplicationLocation(next, {
        roomIds: [],
        memberIds: [],
        agentIds: [],
      }).panel,
    ).toEqual({ kind: "none" });
    const history = push(
      push(
        createCommunityApplicationHistory("agents"),
        location("agents", { kind: "profile", memberId: agent }),
      ),
      next,
    );
    expect(
      currentCommunityApplicationLocation(
        moveCommunityApplicationHistory(history, -1),
      ).panel.kind,
    ).toBe("profile");
  });
});
