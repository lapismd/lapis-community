import type { CommunityRoomModel } from "../community-workspace/model.js";

import type { CommunityApplicationLocation } from "./navigation.js";

export interface CommunityApplicationLocationActions {
  selectRoom(roomId: string): void;
  clearReplyTarget(): void;
  openTopic(topicId: string): void;
  openThread(messageId: string): void;
  openDetails(): void;
  closeSidePanel(): void;
}

export function activateCommunityApplicationLocation(
  location: CommunityApplicationLocation,
  context: {
    roomId: string | undefined;
    activeRoomId: string;
    inboxRoomId: string;
    rooms: readonly CommunityRoomModel[];
    actions: CommunityApplicationLocationActions;
  },
): void {
  const { actions, roomId } = context;
  if (roomId !== undefined && context.activeRoomId !== roomId) {
    actions.selectRoom(roomId);
  }

  if (location.panel.kind === "thread") {
    actions.clearReplyTarget();
    const forum =
      context.rooms.find((room) => room.id === roomId)?.kind === "forum";
    if (forum) actions.openTopic(location.panel.rootMessageId);
    else actions.openThread(location.panel.rootMessageId);
    return;
  }

  if (
    location.panel.kind === "details" &&
    location.panel.roomId !== context.inboxRoomId
  ) {
    actions.clearReplyTarget();
    actions.openDetails();
    return;
  }

  actions.closeSidePanel();
}
