import {
  communityProjectCoordinate,
  communityRepositoryCoordinate,
  type CommunityEntityLink,
} from "../../community/community-links.js";
import {
  isProjectForgeSurface,
  type ProjectForgeSurface,
} from "../../projects/index.js";
import {
  registryRouteFromDestination,
  registryRouteFromHash,
  registryRouteToDestination,
  registryRouteToHash,
  type RegistryRoute,
} from "../../registry/index.js";
import { locationForProjectRoute } from "./project-commit-route.js";
import {
  agentLocationFromHash,
  agentLocationToHash,
  noCommunityApplicationPanel,
  type CommunityApplicationLocation,
} from "./navigation.js";
import { projectRouteFromHash, projectRouteToHash } from "./project-route.js";
import { validRouteCoordinate } from "./project-route.js";

export type ApplicationHashContext = {
  roomKind?(destination: string): "channel" | "forum" | "direct" | undefined;
};

const RESERVED_DESTINATIONS = new Set([
  "inbox",
  "pulse",
  "agents",
  "registry",
  "settings",
  "projects",
  "new-direct-message",
]);

const EVENT_ID = /^[a-f0-9]{64}$/u;

export function locationToHash(
  location: CommunityApplicationLocation,
  context: ApplicationHashContext = {},
): string | null {
  const agent = agentLocationToHash(location);
  if (agent !== null) return agent;
  if (location.projectRoute !== undefined)
    return projectRouteToHash(location.projectRoute);
  if (location.destination === "projects") return "#/projects";
  const registry = registryRouteFromDestination(location.destination);
  if (registry !== null) return registryRouteToHash(registry);
  if (location.destination === "inbox") return "#/inbox";
  const kind = context.roomKind?.(location.destination);
  if (kind === "direct" || !isRoomDestination(location.destination, kind))
    return null;
  const prefix = kind === "forum" ? "forums" : "channels";
  const roomId = encodeURIComponent(location.destination);
  const eventId =
    location.panel.kind === "thread" &&
    EVENT_ID.test(location.panel.rootMessageId)
      ? location.panel.rootMessageId
      : undefined;
  return eventId ? `#/${prefix}/${roomId}/${eventId}` : `#/${prefix}/${roomId}`;
}

export function locationFromHash(
  hash: string,
  options: {
    hasProjects?: boolean;
    hasRegistry?: boolean;
    legacyRegistryRoute?: RegistryRoute;
  } = {},
): CommunityApplicationLocation | null {
  const agent = agentLocationFromHash(hash);
  if (agent) return agent;
  if (hash === "#/inbox") {
    return { destination: "inbox", panel: noCommunityApplicationPanel() };
  }
  if (hash === "#/projects") {
    return options.hasProjects === false
      ? null
      : { destination: "projects", panel: noCommunityApplicationPanel() };
  }
  const project = projectRouteFromHash(hash);
  if (project !== null) {
    return options.hasProjects === false
      ? null
      : locationForProjectRoute(project);
  }
  const registry = registryFromHash(hash, options.legacyRegistryRoute);
  if (registry !== null) {
    return options.hasRegistry === false
      ? null
      : {
          destination: registryRouteToDestination(registry),
          panel: noCommunityApplicationPanel(),
        };
  }
  const room = /^#\/(channels|forums)\/([^/]+)(?:\/([a-f0-9]{64}))?$/u.exec(
    hash,
  );
  if (!room) return null;
  let roomId: string;
  try {
    roomId = decodeURIComponent(room[2]!);
  } catch {
    return null;
  }
  if (!validRouteCoordinate(roomId)) return null;
  const eventId = room[3];
  return {
    destination: roomId,
    panel: eventId
      ? { kind: "thread", roomId, rootMessageId: eventId }
      : noCommunityApplicationPanel(),
  };
}

export function syncBrowserApplicationLocation(
  location: CommunityApplicationLocation,
  mode: "push" | "replace",
  context: ApplicationHashContext = {},
): void {
  if (typeof window === "undefined") return;
  const hash = locationToHash(location, context);
  if (hash) {
    if (window.location.hash !== hash) {
      if (mode === "push") window.history.pushState(null, "", hash);
      else window.history.replaceState(null, "", hash);
    }
    return;
  }
  if (!isCommunityApplicationHash(window.location.hash)) return;
  const url = `${window.location.pathname}${window.location.search}`;
  if (mode === "push") window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
}

export function isCommunityApplicationHash(hash: string): boolean {
  return (
    hash === "#/inbox" ||
    hash === "#/projects" ||
    hash.startsWith("#/channels/") ||
    hash.startsWith("#/forums/") ||
    hash.startsWith("#/agents") ||
    hash.startsWith("#/registry") ||
    hash.startsWith("#/projects/") ||
    hash.startsWith("#post-")
  );
}

export function locationForCommunityEntityLink(
  link: CommunityEntityLink,
): CommunityApplicationLocation {
  if (link.kind === "channel") {
    return { destination: link.roomId, panel: noCommunityApplicationPanel() };
  }
  if (link.kind === "message") {
    return {
      destination: link.roomId,
      panel: {
        kind: "thread",
        roomId: link.roomId,
        rootMessageId: link.threadRootId ?? link.eventId,
      },
    };
  }
  const coordinate =
    link.kind === "project"
      ? communityProjectCoordinate(link.owner, link.d)
      : communityRepositoryCoordinate(link.owner, link.d);
  const fallback: ProjectForgeSurface =
    link.kind === "project" ? "activity" : "overview";
  const surface = isProjectForgeSurface(link.tab) ? link.tab : fallback;
  return locationForProjectRoute({
    kind: link.kind === "project" ? "project" : "repository",
    coordinate,
    surface,
    ...(link.kind === "repo" && link.commit ? { commitSha: link.commit } : {}),
  });
}

export function applicationRoomKind(
  destination: string,
  rooms: readonly { id: string; kind: string }[],
): "channel" | "forum" | "direct" | undefined {
  const room = rooms.find((item) => item.id === destination);
  if (
    room?.kind === "forum" ||
    room?.kind === "channel" ||
    room?.kind === "direct"
  ) {
    return room.kind;
  }
  return isRoomDestination(destination) ? "channel" : undefined;
}

function isRoomDestination(
  destination: string,
  kind?: "channel" | "forum" | "direct" | undefined,
): boolean {
  if (kind === "channel" || kind === "forum") return true;
  return (
    !RESERVED_DESTINATIONS.has(destination) &&
    registryRouteFromDestination(destination) === null &&
    !destination.startsWith("projects")
  );
}

function registryFromHash(
  hash: string,
  legacy?: RegistryRoute,
): RegistryRoute | null {
  const route = registryRouteFromHash(hash);
  if (route !== null) return route;
  if (!hash.startsWith("#post-") || legacy?.page !== "plugin") return null;
  const postId = hash.slice("#post-".length);
  return /^[0-9a-f]{64}$/u.test(postId)
    ? { ...legacy, view: "reviews", postId }
    : null;
}
