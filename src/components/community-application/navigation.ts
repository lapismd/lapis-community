import {
  APP_SHELL_LAYOUT_VERSION,
  type AppShellSidebarLayout,
} from "@lapismd/design-core/shell";
import type { ProjectForgeSurface } from "../../projects/index.js";

export type CommunityApplicationDestination =
  | "inbox"
  | "pulse"
  | "agents"
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
  | { kind: "profile"; memberId: string }
  | { kind: "agent-activity"; agentPubkey: string; channelId?: string };

export type CommunityApplicationMainSurface =
  | "release-reviews"
  | "release-people"
  | "projects-activity"
  | "projects-projects"
  | "projects-repositories"
  | "projects-tasks"
  | "projects-reviews"
  | "projects-channels"
  | "project-overview"
  | "project-tasks"
  | "project-reviews"
  | "project-commits"
  | "project-files"
  | "project-channels"
  | "project-contributors"
  | "project-people";

export interface CommunityApplicationLocation {
  destination: CommunityApplicationDestination;
  panel: CommunityApplicationPanel;
  /** Omission preserves the destination's normal workspace surface. */
  mainSurface?: CommunityApplicationMainSurface;
  /** Durable top-level project or repository route. Nested selections remain local. */
  projectRoute?: CommunityApplicationProjectRoute;
}

export type CommunityApplicationProjectRoute =
  | {
      kind: "project";
      coordinate: string;
      surface: ProjectForgeSurface;
    }
  | {
      kind: "repository";
      coordinate: string;
      surface: ProjectForgeSurface;
    };

export interface CommunityApplicationHistory {
  entries: CommunityApplicationLocation[];
  index: number;
}

export interface CommunityApplicationLocationTargets {
  roomIds: readonly string[];
  memberIds: readonly string[];
  agentIds?: readonly string[];
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

const COMMUNITY_APPLICATION_DESTINATION_VERSION = 2 as const;

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
      (value.version !== 1 &&
        value.version !== COMMUNITY_APPLICATION_DESTINATION_VERSION) ||
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

export function loadCommunityApplicationLocation(
  storage: CommunityApplicationDestinationStorage | undefined,
  key = COMMUNITY_APPLICATION_DESTINATION_STORAGE_KEY,
): CommunityApplicationLocation | null {
  const destination = loadCommunityApplicationDestination(storage, key);
  if (destination === null || !storage) return null;
  try {
    const serialized = storage.getItem(key);
    if (!serialized) return null;
    const value = JSON.parse(serialized) as Record<string, unknown>;
    if (value.version !== COMMUNITY_APPLICATION_DESTINATION_VERSION) {
      return { destination, panel: noCommunityApplicationPanel() };
    }
    const projectRoute = parseStoredProjectRoute(value.projectRoute);
    const mainSurface = parseMainSurface(value.mainSurface);
    return {
      destination,
      panel: noCommunityApplicationPanel(),
      ...(mainSurface === undefined ? {} : { mainSurface }),
      ...(projectRoute === undefined ? {} : { projectRoute }),
    };
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

export function saveCommunityApplicationLocation(
  storage: CommunityApplicationDestinationStorage | undefined,
  location: CommunityApplicationLocation,
  key = COMMUNITY_APPLICATION_DESTINATION_STORAGE_KEY,
): void {
  if (!storage) return;
  try {
    storage.setItem(
      key,
      JSON.stringify({
        version: COMMUNITY_APPLICATION_DESTINATION_VERSION,
        destination: location.destination,
        ...(location.mainSurface === undefined
          ? {}
          : { mainSurface: location.mainSurface }),
        ...(location.projectRoute === undefined
          ? {}
          : { projectRoute: location.projectRoute }),
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
  destination: CommunityApplicationDestination | CommunityApplicationLocation,
): CommunityApplicationHistory {
  return {
    entries: [
      typeof destination === "string"
        ? { destination, panel: noCommunityApplicationPanel() }
        : destination,
    ],
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
    case "agent-activity":
      return `agent-activity:${panel.agentPubkey}:${panel.channelId ?? ""}`;
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
    projectRouteKey(left.projectRoute) ===
      projectRouteKey(right.projectRoute) &&
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

  const agentExists =
    panel.kind !== "agent-activity" ||
    (targets.agentIds ?? targets.memberIds).includes(panel.agentPubkey);
  const panelExists =
    roomExists && memberExists && messageExists && agentExists;
  const surfaceExists =
    location.mainSurface === undefined ||
    (location.mainSurface.startsWith("release-") &&
      targets.releaseRoomIds?.includes(location.destination) === true) ||
    (location.mainSurface.startsWith("projects-") &&
      location.destination === "projects") ||
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
    ...(location.projectRoute === undefined
      ? {}
      : { projectRoute: location.projectRoute }),
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

const PROJECT_FORGE_SURFACES = new Set<ProjectForgeSurface>([
  "overview",
  "tasks",
  "reviews",
  "commits",
  "files",
  "channels",
  "contributors",
  "people",
]);

function isProjectForgeSurface(value: unknown): value is ProjectForgeSurface {
  return (
    typeof value === "string" &&
    PROJECT_FORGE_SURFACES.has(value as ProjectForgeSurface)
  );
}

function parseMainSurface(
  value: unknown,
): CommunityApplicationMainSurface | undefined {
  return typeof value === "string" &&
    (value.startsWith("project-") ||
      value.startsWith("projects-") ||
      value.startsWith("release-"))
    ? (value as CommunityApplicationMainSurface)
    : undefined;
}

function parseStoredProjectRoute(
  value: unknown,
): CommunityApplicationProjectRoute | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const route = value as Record<string, unknown>;
  return (route.kind === "project" || route.kind === "repository") &&
    validRouteCoordinate(route.coordinate) &&
    isProjectForgeSurface(route.surface)
    ? {
        kind: route.kind,
        coordinate: route.coordinate,
        surface: route.surface,
      }
    : undefined;
}

function validRouteCoordinate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 1024 &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function projectRouteKey(
  route: CommunityApplicationProjectRoute | undefined,
): string {
  return route === undefined
    ? ""
    : `${route.kind}:${route.coordinate}:${route.surface}`;
}

export function projectRouteToHash(
  route: CommunityApplicationProjectRoute,
): string {
  const surface = route.surface === "overview" ? "" : `/${route.surface}`;
  return `#/projects/${route.kind}/${encodeURIComponent(route.coordinate)}${surface}`;
}

export function projectRouteFromHash(
  hash: string,
): CommunityApplicationProjectRoute | null {
  const match =
    /^#\/projects\/(project|repository)\/([^/]+)(?:\/([^/]+))?$/u.exec(hash);
  if (!match) return null;
  try {
    const coordinate = decodeURIComponent(match[2]!);
    const surface = match[3] ?? "overview";
    if (!validRouteCoordinate(coordinate) || !isProjectForgeSurface(surface)) {
      return null;
    }
    return { kind: match[1] as "project" | "repository", coordinate, surface };
  } catch {
    return null;
  }
}

/** Agent routes contain identities and filters, never decoded private activity. */
export function agentLocationToHash(
  location: CommunityApplicationLocation,
): string | null {
  if (location.destination !== "agents") return null;
  const panel = location.panel;
  const params = new URLSearchParams();
  if (panel.kind === "profile") params.set("agent", panel.memberId);
  if (panel.kind === "agent-activity") {
    params.set("agent", panel.agentPubkey);
    params.set("activity", "1");
    if (panel.channelId) params.set("channel", panel.channelId);
  }
  return `#/agents${params.size ? `?${params}` : ""}`;
}

export function agentLocationFromHash(
  hash: string,
): CommunityApplicationLocation | null {
  if (hash !== "#/agents" && !hash.startsWith("#/agents?")) return null;
  const params = new URLSearchParams(hash.split("?")[1]);
  const agent = params.get("agent");
  const channel = params.get("channel");
  if (agent !== null && !/^[0-9a-f]{64}$/u.test(agent)) return null;
  if (channel !== null && !validRouteCoordinate(channel)) return null;
  return {
    destination: "agents",
    panel:
      agent === null
        ? { kind: "none" }
        : params.get("activity") === "1"
          ? {
              kind: "agent-activity",
              agentPubkey: agent,
              ...(channel ? { channelId: channel } : {}),
            }
          : { kind: "profile", memberId: agent },
  };
}
