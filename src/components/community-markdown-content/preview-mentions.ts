import {
  contentMentionLabel,
  contentMentionMatches,
} from "../../community/content-mentions.js";
import {
  isFencedCodePosition,
  isInlineCodePosition,
} from "../community-chat-composer/model.js";
import type { CommunityMemberModel } from "../community-workspace/model.js";

export function previewCommunityMarkdown(
  content: string,
  members: readonly CommunityMemberModel[],
  mentionPubkeys: readonly string[] = [],
): {
  content: string;
  members: CommunityMemberModel[];
  mentionPubkeys: string[];
} {
  const mentions = contentMentionMatches(content).filter(
    (mention) =>
      !isFencedCodePosition(content, mention.start) &&
      !isInlineCodePosition(content, mention.start),
  );
  const extras = new Map<string, CommunityMemberModel>();
  for (const mention of mentions) {
    if (
      members.some((member) => member.id === mention.pubkey) ||
      extras.has(mention.pubkey)
    ) {
      continue;
    }
    const handle = mention.value.slice("nostr:".length);
    extras.set(mention.pubkey, {
      id: mention.pubkey,
      name: handle,
      handle,
      initials: handle.slice(4, 6).toUpperCase() || "?",
    });
  }
  const previewMembers = [...members, ...extras.values()];
  let next = content;
  for (const mention of [...mentions].reverse()) {
    next =
      next.slice(0, mention.start) +
      contentMentionLabel(mention.pubkey, mention.value, previewMembers) +
      next.slice(mention.end);
  }
  return {
    content: next,
    members: previewMembers,
    mentionPubkeys: [
      ...new Set([...mentionPubkeys, ...mentions.map((item) => item.pubkey)]),
    ],
  };
}
