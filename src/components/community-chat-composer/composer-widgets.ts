import { WidgetType } from "@codemirror/view";

import type { CommunityCustomEmoji } from "../../community/index.js";
import { isSafeCommunityEmojiUrl } from "./model.js";

export class CommunityEmojiWidget extends WidgetType {
  constructor(
    readonly shortcode: string,
    readonly url: string,
  ) {
    super();
  }

  override eq(other: CommunityEmojiWidget): boolean {
    return other.shortcode === this.shortcode && other.url === this.url;
  }

  override toDOM(): HTMLElement {
    const image = document.createElement("img");
    image.className = "community-composer-emoji";
    image.src = this.url;
    image.alt = `:${this.shortcode}:`;
    image.title = `:${this.shortcode}:`;
    image.draggable = false;
    image.dataset.uiPart = "composer-custom-emoji";
    return image;
  }
}

export function communityEmojiMatches(
  value: string,
  emojis: readonly CommunityCustomEmoji[],
): Array<{ from: number; to: number; emoji: CommunityCustomEmoji }> {
  const normalizedValue = value.toLocaleLowerCase();
  const byShortcode = new Map<string, CommunityCustomEmoji[]>();
  for (const emoji of emojis) {
    const shortcode = emoji.shortcode.trim().toLocaleLowerCase();
    if (shortcode === "" || !isSafeCommunityEmojiUrl(emoji.url)) continue;
    byShortcode.set(shortcode, [...(byShortcode.get(shortcode) ?? []), emoji]);
  }

  const matches: Array<{
    from: number;
    to: number;
    emoji: CommunityCustomEmoji;
  }> = [];
  for (const entries of byShortcode.values()) {
    if (entries.length !== 1) continue;
    const emoji = entries[0]!;
    const token = `:${emoji.shortcode.trim()}:`;
    const normalizedToken = token.toLocaleLowerCase();
    let from = normalizedValue.indexOf(normalizedToken);
    while (from >= 0) {
      matches.push({ from, to: from + token.length, emoji });
      from = normalizedValue.indexOf(normalizedToken, from + 1);
    }
  }
  return matches.sort((left, right) => left.from - right.from);
}
