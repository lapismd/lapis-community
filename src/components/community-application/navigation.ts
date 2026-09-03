export type CommunityApplicationDestination =
  | "inbox"
  | "registry"
  | "settings"
  | string;

export type CommunityApplicationPanel =
  | { kind: "none" }
  | { kind: "details"; roomId: string }
  | {
      kind: "thread";
      roomId: string;
      rootMessageId: string;
      replyTargetId?: string;
    }
  | { kind: "profile"; memberId: string };

export interface CommunityApplicationLocation {
  destination: CommunityApplicationDestination;
  panel: CommunityApplicationPanel;
}

export interface CommunityApplicationHistory {
  entries: CommunityApplicationLocation[];
  index: number;
}

export interface CommunityApplicationLocationTargets {
  roomIds: readonly string[];
  memberIds: readonly string[];
  messageIds?: readonly string[];
}

export const noCommunityApplicationPanel = (): CommunityApplicationPanel => ({
  kind: "none",
});

export function createCommunityApplicationHistory(
  destination: CommunityApplicationDestination,
): CommunityApplicationHistory {
  return {
    entries: [{ destination, panel: noCommunityApplicationPanel() }],
    index: 0,
  };
}

export function currentCommunityApplicationLocation(
  history: CommunityApplicationHistory,
): CommunityApplicationLocation {
  return history.entries[history.index]!;
}

export function pushCommunityApplicationLocation(
  history: CommunityApplicationHistory,
  location: CommunityApplicationLocation,
): CommunityApplicationHistory {
  if (
    communityApplicationLocationsEqual(
      currentCommunityApplicationLocation(history),
      location,
    )
  ) {
    return history;
  }

  return {
    entries: [...history.entries.slice(0, history.index + 1), location],
    index: history.index + 1,
  };
}

export function replaceCommunityApplicationLocation(
  history: CommunityApplicationHistory,
  location: CommunityApplicationLocation,
): CommunityApplicationHistory {
  if (
    communityApplicationLocationsEqual(
      currentCommunityApplicationLocation(history),
      location,
    )
  ) {
    return history;
  }

  return {
    entries: history.entries.map((entry, index) =>
      index === history.index ? location : entry,
    ),
    index: history.index,
  };
}

export function moveCommunityApplicationHistory(
  history: CommunityApplicationHistory,
  offset: -1 | 1,
): CommunityApplicationHistory {
  const index = history.index + offset;
  if (index < 0 || index >= history.entries.length) return history;
  return { ...history, index };
}

export function communityApplicationPanelKey(
  panel: CommunityApplicationPanel,
): string {
  switch (panel.kind) {
    case "none":
      return "none";
    case "details":
      return `details:${panel.roomId}`;
    case "profile":
      return `profile:${panel.memberId}`;
    case "thread":
      return `thread:${panel.roomId}:${panel.rootMessageId}:${panel.replyTargetId ?? ""}`;
  }
}

export function communityApplicationLocationsEqual(
  left: CommunityApplicationLocation,
  right: CommunityApplicationLocation,
): boolean {
  return (
    left.destination === right.destination &&
    communityApplicationPanelKey(left.panel) ===
      communityApplicationPanelKey(right.panel)
  );
}

export function normalizeCommunityApplicationLocation(
  location: CommunityApplicationLocation,
  targets: CommunityApplicationLocationTargets,
): CommunityApplicationLocation {
  const panel = location.panel;
  const roomExists =
    panel.kind !== "details" && panel.kind !== "thread"
      ? true
      : targets.roomIds.includes(panel.roomId);
  const memberExists =
    panel.kind !== "profile" || targets.memberIds.includes(panel.memberId);
  const messageExists =
    panel.kind !== "thread" ||
    targets.messageIds === undefined ||
    (targets.messageIds.includes(panel.rootMessageId) &&
      (panel.replyTargetId === undefined ||
        targets.messageIds.includes(panel.replyTargetId)));

  return roomExists && memberExists && messageExists
    ? location
    : {
        destination: location.destination,
        panel: noCommunityApplicationPanel(),
      };
}
