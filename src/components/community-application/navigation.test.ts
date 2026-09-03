import { describe, expect, it } from "vitest";

import {
  createCommunityApplicationHistory,
  currentCommunityApplicationLocation,
  moveCommunityApplicationHistory,
  noCommunityApplicationPanel,
  normalizeCommunityApplicationLocation,
  pushCommunityApplicationLocation,
  replaceCommunityApplicationLocation,
  type CommunityApplicationHistory,
  type CommunityApplicationLocation,
} from "./navigation.js";

const location = (
  destination: string,
  panel: CommunityApplicationLocation["panel"] = noCommunityApplicationPanel(),
): CommunityApplicationLocation => ({ destination, panel });

const push = (
  history: CommunityApplicationHistory,
  next: CommunityApplicationLocation,
): CommunityApplicationHistory =>
  pushCommunityApplicationLocation(history, next);

describe("Community application location history", () => {
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
