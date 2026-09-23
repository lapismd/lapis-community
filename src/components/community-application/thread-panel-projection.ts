import type { CommunityApplicationPanel } from "./navigation.js";

export function communityApplicationThreadProjectionMatches(
  panel: CommunityApplicationPanel,
  workspace: {
    activeRoomId: string;
    thread?: { rootMessageId: string };
  },
): boolean {
  return (
    panel.kind === "thread" &&
    workspace.activeRoomId === panel.roomId &&
    workspace.thread?.rootMessageId === panel.rootMessageId
  );
}

export function communityApplicationThreadProjectionSettled(
  panel: CommunityApplicationPanel,
  workspace: {
    activeRoomId: string;
    sidePanel?: string;
    thread?: { rootMessageId: string };
  },
): boolean {
  return (
    communityApplicationThreadProjectionMatches(panel, workspace) &&
    workspace.sidePanel === "thread"
  );
}
