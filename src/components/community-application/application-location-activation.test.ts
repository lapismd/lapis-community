import { describe, expect, it, vi } from "vitest";

import type { CommunityRoomModel } from "../community-workspace/model.js";

import {
  activateCommunityApplicationLocation,
  type CommunityApplicationLocationActions,
} from "./application-location-activation.js";

const rootMessageId = "a".repeat(64);
const inboxRoomId = "inbox";
const rooms = [
  { id: "general", kind: "channel" },
  { id: "support", kind: "forum" },
] as CommunityRoomModel[];

function actions(): CommunityApplicationLocationActions {
  return {
    selectRoom: vi.fn(),
    clearReplyTarget: vi.fn(),
    openTopic: vi.fn(),
    openThread: vi.fn(),
    openDetails: vi.fn(),
    closeSidePanel: vi.fn(),
  };
}

describe("activateCommunityApplicationLocation", () => {
  it("opens a restored thread even when its room is already selected", () => {
    const target = actions();

    activateCommunityApplicationLocation(
      {
        destination: "general",
        panel: { kind: "thread", roomId: "general", rootMessageId },
      },
      {
        roomId: "general",
        activeRoomId: "general",
        inboxRoomId,
        rooms,
        actions: target,
      },
    );

    expect(target.selectRoom).not.toHaveBeenCalled();
    expect(target.clearReplyTarget).toHaveBeenCalledOnce();
    expect(target.openThread).toHaveBeenCalledWith(rootMessageId);
  });

  it("selects another room before opening its channel thread", () => {
    const target = actions();

    activateCommunityApplicationLocation(
      {
        destination: "general",
        panel: { kind: "thread", roomId: "general", rootMessageId },
      },
      {
        roomId: "general",
        activeRoomId: "support",
        inboxRoomId,
        rooms,
        actions: target,
      },
    );

    expect(target.selectRoom).toHaveBeenCalledWith("general");
    expect(target.openThread).toHaveBeenCalledWith(rootMessageId);
  });

  it("restores forum topics through the forum projection", () => {
    const target = actions();

    activateCommunityApplicationLocation(
      {
        destination: "support",
        panel: { kind: "thread", roomId: "support", rootMessageId },
      },
      {
        roomId: "support",
        activeRoomId: "support",
        inboxRoomId,
        rooms,
        actions: target,
      },
    );

    expect(target.openTopic).toHaveBeenCalledWith(rootMessageId);
    expect(target.openThread).not.toHaveBeenCalled();
  });

  it("opens room details outside the Inbox", () => {
    const target = actions();

    activateCommunityApplicationLocation(
      {
        destination: "general",
        panel: { kind: "details", roomId: "general" },
      },
      {
        roomId: "general",
        activeRoomId: "general",
        inboxRoomId,
        rooms,
        actions: target,
      },
    );

    expect(target.openDetails).toHaveBeenCalledOnce();
  });
});
