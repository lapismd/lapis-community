import { communityComposerDraftKey } from "../community-chat-composer/composer-draft-keys.js";
import type {
  CommunityMessageModel,
  CommunityRoomModel,
} from "../community-workspace/model.js";

export function threadComposerRoomId(
  rooms: readonly CommunityRoomModel[],
  rootMessage?: CommunityMessageModel,
  replyRoomId?: string,
): string {
  if (replyRoomId) return replyRoomId;
  const host = rootMessage?.sourceEvent?.tags.find(([key]) => key === "h")?.[1];
  return (
    rooms.find((room) => (room.groupId ?? room.id) === host)?.id ??
    rooms[0]?.id ??
    ""
  );
}

export function communityThreadComposerDraftKey(input: {
  viewer?: string | undefined;
  communityId?: string | undefined;
  roomId?: string;
  rootMessageId: string;
}): string {
  return communityComposerDraftKey({
    viewer: input.viewer,
    communityId: input.communityId,
    surface: "thread",
    target: input.roomId
      ? `${input.roomId}:${input.rootMessageId}`
      : input.rootMessageId,
  });
}
