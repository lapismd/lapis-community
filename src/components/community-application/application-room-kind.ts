import { registryRouteFromDestination } from "../../registry/index.js";

const RESERVED_DESTINATIONS = new Set([
  "inbox",
  "pulse",
  "agents",
  "registry",
  "settings",
  "projects",
  "new-direct-message",
]);

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

export function isRoomDestination(
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
