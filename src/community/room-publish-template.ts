import {
  createNip29ForumCommentTemplate,
  type NostrEvent,
  type NostrEventTemplate,
} from "../protocol/index.js";
import {
  mentionPubkeysForPublish,
  publishMentionTags,
  withPublishMentionTags,
} from "./publish-mention-tags.js";

export function createCommunityChannelMessageTemplate(
  groupId: string,
  content: string,
  createdAt: number,
  mentionPubkeys: readonly string[] = [],
): NostrEventTemplate {
  return {
    kind: 9,
    created_at: createdAt,
    content,
    tags: publishMentionTags(
      [["h", groupId]],
      mentionPubkeysForPublish(content, mentionPubkeys),
    ),
  };
}

export function createCommunityReplyTemplate(input: {
  roomKind: "forum" | "channel" | "direct";
  groupId: string;
  parent: Pick<NostrEvent, "id" | "kind" | "pubkey" | "tags">;
  root: Pick<NostrEvent, "id" | "kind" | "pubkey">;
  content: string;
  createdAt: number;
  relayUrl: string;
  mentionPubkeys?: readonly string[] | undefined;
}): NostrEventTemplate {
  if (input.roomKind === "forum") {
    return withPublishMentionTags(
      createNip29ForumCommentTemplate(
        input.groupId,
        input.root,
        input.parent,
        input.content,
        input.createdAt,
        input.relayUrl,
      ),
      input.mentionPubkeys,
    );
  }
  const rootId =
    input.parent.tags.find((tag) => tag[0] === "e" && tag[3] === "root")?.[1] ??
    input.parent.id;
  return createCommunityChannelReplyTemplate(
    input.groupId,
    rootId,
    input.parent.id,
    input.parent.pubkey,
    input.content,
    input.createdAt,
    input.relayUrl,
    input.mentionPubkeys,
  );
}

export function createCommunityChannelReplyTemplate(
  groupId: string,
  rootId: string,
  parentId: string,
  parentPubkey: string,
  content: string,
  createdAt: number,
  relayUrl: string,
  mentionPubkeys: readonly string[] = [],
): NostrEventTemplate {
  return {
    kind: 9,
    created_at: createdAt,
    content,
    tags: publishMentionTags(
      [
        ["h", groupId],
        ["e", rootId, relayUrl, "root"],
        ["e", parentId, relayUrl, "reply"],
        ["p", parentPubkey],
      ],
      mentionPubkeysForPublish(content, mentionPubkeys),
    ),
  };
}
