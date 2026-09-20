import {
  findCommunityRoom,
  type CommunityMemberModel,
  type CommunityRoomModel,
  type CommunityWorkspaceModel,
} from "./model.js";

export function workspaceSurfaceRoom(
  model: CommunityWorkspaceModel,
): CommunityRoomModel {
  return (
    findCommunityRoom(model) ?? {
      id: model.activeRoomId,
      name: "Community",
      kind: "channel",
      description: "Community conversation",
    }
  );
}

export function workspaceDirectMember(
  room: Pick<CommunityRoomModel, "kind" | "name" | "participantIds">,
  members: readonly CommunityMemberModel[],
  currentMemberId?: string,
): CommunityMemberModel | undefined {
  if (room.kind !== "direct") return undefined;
  return (
    room.participantIds
      ?.filter((id) => id !== currentMemberId)
      .map((id) => members.find((member) => member.id === id))
      .find((member) => member !== undefined) ??
    members.find((member) => member.name === room.name)
  );
}

export function sendWorkspaceContent(
  send:
    | ((
        roomId: string,
        content: string,
        mentionPubkeys?: readonly string[],
      ) => void | Promise<void>)
    | undefined,
  roomId: string,
  content: string,
  mentionPubkeys?: readonly string[],
): void | Promise<void> {
  return mentionPubkeys?.length
    ? send?.(roomId, content, mentionPubkeys)
    : send?.(roomId, content);
}
