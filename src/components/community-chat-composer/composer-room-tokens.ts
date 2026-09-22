import type { CommunityRoomModel } from "../community-workspace/model.js";

export function composerRoomReferenceTokens(
  rooms: readonly CommunityRoomModel[],
) {
  return rooms
    .filter((room) => room.kind !== "direct" && room.archived !== true)
    .map((room) => ({
      token: `#${room.name.trim()}`,
      kind: "channel" as const,
      roomId: room.id,
    }));
}

export function composerTokenRoom(
  roomId: string | undefined,
  rooms: readonly CommunityRoomModel[],
): CommunityRoomModel | undefined {
  if (!roomId) return undefined;
  const id = roomId.trim().toLocaleLowerCase();
  return rooms.find((room) => room.id.trim().toLocaleLowerCase() === id);
}
