import {
  communityComposerAudienceScope,
  initialThreadAgentPubkeys,
  type CommunityComposerAgentModel,
  type CommunityComposerAudienceScope,
} from "../community-chat-composer/composer-agent-model.js";
import type {
  CommunityMessageModel,
  CommunityRoomModel,
} from "../community-workspace/model.js";

export function threadComposerAudience(
  currentMemberId: string | undefined,
  rooms: readonly CommunityRoomModel[],
  rootMessage: CommunityMessageModel | undefined,
  threadRootId: string,
  agents: readonly CommunityComposerAgentModel[],
): {
  audience?: CommunityComposerAudienceScope;
  initialAgentPubkeys: readonly string[];
} {
  const channelId =
    rooms.find(
      (room) =>
        (room.groupId ?? room.id) ===
        rootMessage?.sourceEvent?.tags.find(([key]) => key === "h")?.[1],
    )?.id ?? rooms.find((room) => room.kind !== "direct")?.id;
  const audience = communityComposerAudienceScope(
    currentMemberId,
    channelId,
    threadRootId,
  );
  return {
    ...(audience === undefined ? {} : { audience }),
    initialAgentPubkeys: initialThreadAgentPubkeys(
      rootMessage?.mentionPubkeys,
      agents,
    ),
  };
}

export function sendThreadContent(
  send:
    | ((
        rootMessageId: string,
        content: string,
        mentionPubkeys?: readonly string[],
      ) => void | Promise<void>)
    | undefined,
  rootMessageId: string,
  content: string,
  mentionPubkeys: readonly string[] = [],
): void | Promise<void> {
  return mentionPubkeys.length > 0
    ? send?.(rootMessageId, content, mentionPubkeys)
    : send?.(rootMessageId, content);
}
