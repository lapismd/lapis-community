import { npubEncode } from "nostr-tools/nip19";

import type { CommunityComposerAutocompleteItem } from "./autocomplete.js";

const HEX_PUBKEY = /^[0-9a-f]{64}$/u;

export function communityComposerMentionToken(
  pubkey: string,
): string | undefined {
  const id = pubkey.trim().toLowerCase();
  if (!HEX_PUBKEY.test(id)) return undefined;
  return `nostr:${npubEncode(id)}`;
}

export function communityComposerMentionInsert(member: {
  id: string;
  name: string;
}): string {
  const token = communityComposerMentionToken(member.id);
  if (token) return `${token} `;
  const name = member.name.trim();
  return name === "" ? "" : `@${name} `;
}

export function communityComposerAutocompleteInsert(
  item: CommunityComposerAutocompleteItem,
): string {
  if (item.member !== undefined) {
    return communityComposerMentionInsert(item.member);
  }
  if (item.room !== undefined) return `#${item.room.name} `;
  if (item.customEmoji !== undefined) {
    return `:${item.customEmoji.shortcode}: `;
  }
  const native = item.native?.trim() ?? "";
  return native === "" ? "" : `${native} `;
}
