import { mount, unmount } from "svelte";
import { WidgetType } from "@codemirror/view";

import type { CommunityCustomEmoji } from "../../community/index.js";
import type { CommunityEntityLink } from "../../community/community-links.js";
import type { CommunityMemberModel } from "../community-workspace/model.js";
import CommunityEntityChip from "../community-entity-chip/CommunityEntityChip.svelte";
import {
  communityEntityNavigationKey,
  type CommunityEntityNavigation,
} from "../community-entity-chip/navigation.js";
import CommunityComposerMemberReference from "./CommunityComposerMemberReference.svelte";
import type { CommunityComposerExtensionOptions } from "./composer-extension.js";
import { isSafeCommunityEmojiUrl } from "./model.js";

const widgetCleanup = new WeakMap<HTMLElement, () => void>();

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

export class CommunityMemberWidget extends WidgetType {
  constructor(
    readonly member: CommunityMemberModel,
    readonly label: string,
    readonly options: CommunityComposerExtensionOptions,
  ) {
    super();
  }

  override eq(other: CommunityMemberWidget): boolean {
    return (
      other.member.id === this.member.id &&
      other.member.name === this.member.name &&
      other.member.kind === this.member.kind &&
      other.label === this.label
    );
  }

  override toDOM(): HTMLElement {
    const host = document.createElement("span");
    host.className = "community-composer-member-reference";
    host.dataset.uiPart = "composer-member-reference";
    const component = mount(CommunityComposerMemberReference, {
      target: host,
      props: { member: this.member, label: this.label, options: this.options },
    });
    widgetCleanup.set(host, () => {
      void unmount(component);
    });
    return host;
  }

  override destroy(dom: HTMLElement): void {
    widgetCleanup.get(dom)?.();
    widgetCleanup.delete(dom);
  }
}

export class CommunityEntityWidget extends WidgetType {
  constructor(
    readonly link: CommunityEntityLink,
    readonly href: string,
    readonly navigation?: CommunityEntityNavigation,
  ) {
    super();
  }

  override eq(other: CommunityEntityWidget): boolean {
    return other.href === this.href;
  }

  override toDOM(): HTMLElement {
    const host = document.createElement("span");
    host.className = "community-composer-entity-reference";
    host.dataset.uiPart = "composer-entity-reference";
    const component = mount(CommunityEntityChip, {
      target: host,
      props: { link: this.link },
      context: this.navigation
        ? new Map([[communityEntityNavigationKey, this.navigation]])
        : undefined,
    });
    widgetCleanup.set(host, () => {
      void unmount(component);
    });
    return host;
  }

  override destroy(dom: HTMLElement): void {
    widgetCleanup.get(dom)?.();
    widgetCleanup.delete(dom);
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
