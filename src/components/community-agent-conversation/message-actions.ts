import { nip19 } from "nostr-tools";
import type { NostrEvent, NostrEventTemplate } from "../../protocol/index.js";
import { COMMUNITY_MESSAGE_EDIT_KIND } from "../../community/message-moderation.js";
import { eventTag } from "./model.js";

export function discussionEdit(
  event: NostrEvent,
  author: string | undefined,
  content: string,
): NostrEventTemplate {
  if (event.pubkey !== author)
    throw new Error("Only the author can edit this message");
  const channel = eventTag(event, "h");
  if (!channel || ![9, 11, 1111].includes(event.kind) || !content.trim())
    throw new Error("Write a message before saving");
  return {
    kind: COMMUNITY_MESSAGE_EDIT_KIND,
    created_at: Math.floor(Date.now() / 1000),
    content: content.trim(),
    tags: [
      ["h", channel],
      ["e", event.id],
    ],
  };
}

export function discussionDeletion(
  event: NostrEvent,
  author: string | undefined,
): NostrEventTemplate {
  if (event.pubkey !== author)
    throw new Error("Only the author can delete this message");
  const channel = eventTag(event, "h");
  if (!channel) throw new Error("The message channel is unavailable");
  return {
    kind: 5,
    created_at: Math.floor(Date.now() / 1000),
    content: "",
    tags: [
      ["h", channel],
      ["e", event.id],
      ["k", String(event.kind)],
    ],
  };
}

export const discussionPermalink = (event: NostrEvent) =>
  `nostr:${nip19.neventEncode({ id: event.id, author: event.pubkey })}`;
