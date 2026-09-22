import type { CommunityComposerAutocompleteItem } from "./autocomplete.js";
import { communityComposerMentionInsert } from "./composer-mention-token.js";
import { composerSlashInsert } from "./composer-slash-insert.js";

export {
  communityComposerMentionInsert,
  communityComposerMentionToken,
} from "./composer-mention-token.js";

export function communityComposerAutocompleteInsert(
  item: CommunityComposerAutocompleteItem,
): string {
  if (item.kind === "slash") return composerSlashInsert(item);
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
