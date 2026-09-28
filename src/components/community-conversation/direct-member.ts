import type {
  CommunityMemberModel,
  CommunityRoomModel,
} from "../community-workspace/model.js";

export function resolveDirectMember(
  room: CommunityRoomModel,
  directMember: CommunityMemberModel | undefined,
): CommunityMemberModel {
  return (
    directMember ?? {
      id: room.id,
      name: room.name,
      handle: room.id,
      initials:
        room.name
          .split(/\s+/u)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0]?.toLocaleUpperCase() ?? "")
          .join("") || "?",
      presence: "offline",
    }
  );
}
