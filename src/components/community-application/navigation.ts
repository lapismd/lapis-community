import {
  APP_SHELL_LAYOUT_VERSION,
  type AppShellSidebarLayout,
} from "@lapismd/design-core/shell";

export type CommunityApplicationDestination =
  | "inbox"
  | "pulse"
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

export type CommunityApplicationMainSurface =
  | "release-reviews"
  | "release-people"
  | "project-tasks"
  | "project-reviews"
  | "project-commits"
  | "project-files"
  | "project-people";

export interface CommunityApplicationLocation {
  destination: CommunityApplicationDestination;
  panel: CommunityApplicationPanel;
  /** Omission preserves the destination's normal workspace surface. */
  mainSurface?: CommunityApplicationMainSurface;
}

export interface CommunityApplicationHistory {
  entries: CommunityApplicationLocation[];
  index: number;
}

export interface CommunityApplicationLocationTargets {
  roomIds: readonly string[];
  memberIds: readonly string[];
  messageIds?: readonly string[];
  releaseRoomIds?: readonly string[];
  projectDestinationIds?: readonly string[];
}

export const COMMUNITY_APPLICATION_DESTINATION_STORAGE_KEY =
  "@lapismd/lapis-community/application-destination";
export const COMMUNITY_APPLICATION_SHELL_LAYOUT_STORAGE_KEY =
  "@lapismd/lapis-community/app-shell-layout";
export const COMMUNITY_APPLICATION_RELEASE_OVERVIEW_PANEL_ID =
  "plugin-release-overview";
export const COMMUNITY_APPLICATION_PROJECT_OVERVIEW_PANEL_ID =
  "project-overview";

const COMMUNITY_APPLICATION_DESTINATION_VERSION = 1 as const;

type CommunityApplicationDestinationStorage = Pick<
  Storage,
  "getItem" | "setItem"
>;

type CommunityApplicationShellLayoutStorage = Pick<Storage, "getItem">;

export interface CommunityApplicationInitialShellLayout {
  left?: AppShellSidebarLayout;
  right?: AppShellSidebarLayout;
  releaseOverview?: AppShellSidebarLayout;
  projectOverview?: AppShellSidebarLayout;
}

export function loadCommunityApplicationInitialShellLayout(
  storage: CommunityApplicationShellLayoutStorage | undefined,
  key = COMMUNITY_APPLICATION_SHELL_LAYOUT_STORAGE_KEY,
): CommunityApplicationInitialShellLayout {
  if (!storage) return {};
  try {
    const serialized = storage.getItem(key);
    if (!serialized) return {};
    const value = JSON.parse(serialized) as unknown;
    if (
      typeof value !== "object" ||
      value === null ||
      !("version" in value) ||
      value.version !== APP_SHELL_LAYOUT_VERSION ||
      !("panels" in value) ||
      typeof value.panels !== "object" ||
      value.panels === null
    ) {
      return {};
    }

    const panels = value.panels as Record<string, unknown>;
    const readPanel = (
      id: string,
      side: "left" | "right",
    ): AppShellSidebarLayout | undefined => {
      const panel = panels[id];
      if (
        typeof panel !== "object" ||
        panel === null ||
        !("side" in panel) ||
        panel.side !== side ||
        !("collapsed" in panel) ||
        typeof panel.collapsed !== "boolean" ||
        !("closed" in panel) ||
        typeof panel.closed !== "boolean"
      ) {
        return undefined;
      }
      const width =
        "width" in panel &&
        typeof panel.width === "number" &&
        Number.isFinite(panel.width)
          ? panel.width
          : undefined;
      return {
        side,
        collapsed: panel.collapsed,
        closed: panel.closed,
        ...(width === undefined ? {} : { width }),
      };
    };

    const left = readPanel("left", "left");
    const right = readPanel("right", "right");
    const releaseOverview = readPanel(
      COMMUNITY_APPLICATION_RELEASE_OVERVIEW_PANEL_ID,
      "right",
    );
    const projectOverview = readPanel(
      COMMUNITY_APPLICATION_PROJECT_OVERVIEW_PANEL_ID,
      "right",
    );
    return {
      ...(left === undefined ? {} : { left }),
      ...(right === undefined ? {} : { right }),
      ...(releaseOverview === undefined ? {} : { releaseOverview }),
      ...(projectOverview === undefined ? {} : { projectOverview }),
    };
  } catch {
    return {};
  }
}

export function loadCommunityApplicationDestination(
  storage: CommunityApplicationDestinationStorage | undefined,
  key = COMMUNITY_APPLICATION_DESTINATION_STORAGE_KEY,
): CommunityApplicationDestination | null {
  if (!storage) return null;
  try {
    const serialized = storage.getItem(key);
    if (!serialized) return null;
    const value = JSON.parse(serialized) as unknown;
    if (
      typeof value !== "object" ||
      value === null ||
      !("version" in value) ||
      value.version !== COMMUNITY_APPLICATION_DESTINATION_VERSION ||
      !("destination" in value) ||
      typeof value.destination !== "string"
    ) {
      return null;
    }
    const destination = value.destination;
    return destination.length > 0 &&
      destination.length <= 1024 &&
      destination.trim() === destination &&
      !/[\u0000-\u001f\u007f]/u.test(destination)
      ? destination
      : null;
  } catch {
    return null;
  }
}

export function saveCommunityApplicationDestination(
  storage: CommunityApplicationDestinationStorage | undefined,
  destination: CommunityApplicationDestination,
  key = COMMUNITY_APPLICATION_DESTINATION_STORAGE_KEY,
): void {
  if (!storage) return;
  try {
    storage.setItem(
      key,
      JSON.stringify({
        version: COMMUNITY_APPLICATION_DESTINATION_VERSION,
        destination,
      }),
    );
  } catch {
    // Browser storage may be unavailable or full. Navigation remains usable.
  }
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
    left.mainSurface === right.mainSurface &&
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

  const panelExists = roomExists && memberExists && messageExists;
  const surfaceExists =
    location.mainSurface === undefined ||
    (location.mainSurface.startsWith("release-") &&
      targets.releaseRoomIds?.includes(location.destination) === true) ||
    (location.mainSurface.startsWith("project-") &&
      targets.projectDestinationIds?.includes(location.destination) === true);
  if (panelExists && surfaceExists) return location;
  return {
    destination: location.destination,
    panel: panelExists ? location.panel : noCommunityApplicationPanel(),
    ...(surfaceExists || location.mainSurface === undefined
      ? location.mainSurface === undefined
        ? {}
        : { mainSurface: location.mainSurface }
      : {}),
  };
}

export function projectDestinationFromCoordinate(coordinate: string): string {
  return `projects/${encodeURIComponent(coordinate)}`;
}

export function projectCoordinateFromDestination(
  destination: string,
): string | undefined {
  if (!destination.startsWith("projects/")) return undefined;
  try {
    const coordinate = decodeURIComponent(
      destination.slice("projects/".length),
    );
    return coordinate.length > 0 ? coordinate : undefined;
  } catch {
    return undefined;
  }
}

export function isProjectDestination(destination: string): boolean {
  return (
    destination === "projects" ||
    projectCoordinateFromDestination(destination) !== undefined
  );
}
