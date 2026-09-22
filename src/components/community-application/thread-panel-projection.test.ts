import { describe, expect, it } from "vitest";

import {
  communityApplicationThreadProjectionMatches,
  communityApplicationThreadProjectionSettled,
} from "./thread-panel-projection.js";

const threadA = "a".repeat(64);
const threadB = "b".repeat(64);
const panel = {
  kind: "thread" as const,
  roomId: "general",
  rootMessageId: threadB,
};

describe("communityApplicationThreadProjectionMatches", () => {
  it("waits until the projected thread is the selected root", () => {
    expect(
      communityApplicationThreadProjectionMatches(panel, {
        activeRoomId: "general",
        thread: { rootMessageId: threadA },
      }),
    ).toBe(false);
    expect(
      communityApplicationThreadProjectionMatches(panel, {
        activeRoomId: "general",
        thread: { rootMessageId: threadB },
      }),
    ).toBe(true);
  });
});

describe("communityApplicationThreadProjectionSettled", () => {
  it("does not treat a previous thread projection as the new root", () => {
    expect(
      communityApplicationThreadProjectionSettled(panel, {
        activeRoomId: "general",
        sidePanel: "thread",
        thread: { rootMessageId: threadA },
      }),
    ).toBe(false);
  });

  it("settles only after the matching thread is projected", () => {
    expect(
      communityApplicationThreadProjectionSettled(panel, {
        activeRoomId: "general",
        sidePanel: "thread",
        thread: { rootMessageId: threadB },
      }),
    ).toBe(true);
    expect(
      communityApplicationThreadProjectionSettled(panel, {
        activeRoomId: "general",
        sidePanel: "none",
        thread: { rootMessageId: threadB },
      }),
    ).toBe(false);
  });
});
