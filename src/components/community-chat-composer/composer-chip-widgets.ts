import { type Range } from "@codemirror/state";
import { Decoration, type EditorView, WidgetType } from "@codemirror/view";
import { mount, unmount } from "svelte";

import type { CommunityEntityLink } from "../../community/community-links.js";
import {
  communityEntityNavigationKey,
  type CommunityEntityNavigation,
} from "../community-entity-chip/navigation.js";
import type {
  CommunityMemberModel,
  CommunityRoomModel,
} from "../community-workspace/model.js";
import CommunityComposerChannelChip from "./CommunityComposerChannelChip.svelte";
import CommunityComposerEntityChip from "./CommunityComposerEntityChip.svelte";
import CommunityComposerMemberChip from "./CommunityComposerMemberChip.svelte";
import { removeComposerChipRange } from "./composer-chip-remove.js";
import type { CommunityComposerExtensionOptions } from "./composer-extension.js";

const widgetCleanup = new WeakMap<HTMLElement, () => void>();

class CommunityEntityWidget extends WidgetType {
  constructor(
    readonly link: CommunityEntityLink,
    readonly href: string,
    readonly from: number,
    readonly to: number,
    readonly navigation?: CommunityEntityNavigation,
  ) {
    super();
  }

  override eq(other: CommunityEntityWidget): boolean {
    return (
      other.href === this.href &&
      other.from === this.from &&
      other.to === this.to
    );
  }

  override toDOM(view: EditorView): HTMLElement {
    const host = document.createElement("span");
    host.className = "community-composer-entity-reference";
    host.dataset.uiPart = "composer-entity-reference";
    const component = mount(CommunityComposerEntityChip, {
      target: host,
      props: {
        link: this.link,
        onRemove: () => removeComposerChipRange(view, this.from, this.to),
      },
      ...(this.navigation
        ? {
            context: new Map([[communityEntityNavigationKey, this.navigation]]),
          }
        : {}),
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

class CommunityMemberWidget extends WidgetType {
  constructor(
    readonly member: CommunityMemberModel,
    readonly label: string,
    readonly from: number,
    readonly to: number,
    readonly options: CommunityComposerExtensionOptions,
  ) {
    super();
  }

  override eq(other: CommunityMemberWidget): boolean {
    return (
      other.member.id === this.member.id &&
      other.member.name === this.member.name &&
      other.member.kind === this.member.kind &&
      other.label === this.label &&
      other.from === this.from &&
      other.to === this.to
    );
  }

  override toDOM(view: EditorView): HTMLElement {
    const host = document.createElement("span");
    host.className = "community-composer-member-reference";
    host.dataset.uiPart = "composer-member-reference";
    const component = mount(CommunityComposerMemberChip, {
      target: host,
      props: {
        member: this.member,
        token: this.label,
        options: this.options,
        onRemove: () => removeComposerChipRange(view, this.from, this.to),
      },
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

export function communityEntityChipDecoration(
  match: {
    link: CommunityEntityLink;
    href: string;
    from: number;
    to: number;
  },
  navigation?: CommunityEntityNavigation,
): Range<Decoration> {
  return Decoration.replace({
    widget: new CommunityEntityWidget(
      match.link,
      match.href,
      match.from,
      match.to,
      navigation,
    ),
  }).range(match.from, match.to);
}

class CommunityChannelWidget extends WidgetType {
  constructor(
    readonly room: CommunityRoomModel,
    readonly from: number,
    readonly to: number,
    readonly navigation?: CommunityEntityNavigation,
  ) {
    super();
  }

  override eq(other: CommunityChannelWidget): boolean {
    return (
      other.room.id === this.room.id &&
      other.room.name === this.room.name &&
      other.room.kind === this.room.kind &&
      other.room.isProjectChannel === this.room.isProjectChannel &&
      other.from === this.from &&
      other.to === this.to
    );
  }

  override toDOM(view: EditorView): HTMLElement {
    const host = document.createElement("span");
    host.className = "community-composer-channel-reference";
    host.dataset.uiPart = "composer-channel-reference";
    const component = mount(CommunityComposerChannelChip, {
      target: host,
      props: {
        room: this.room,
        onRemove: () => removeComposerChipRange(view, this.from, this.to),
      },
      ...(this.navigation
        ? {
            context: new Map([[communityEntityNavigationKey, this.navigation]]),
          }
        : {}),
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

export function communityChannelChipDecoration(
  room: CommunityRoomModel,
  from: number,
  to: number,
  navigation?: CommunityEntityNavigation,
): Range<Decoration> {
  return Decoration.replace({
    widget: new CommunityChannelWidget(room, from, to, navigation),
  }).range(from, to);
}

export function communityMemberChipDecoration(
  member: CommunityMemberModel,
  token: string,
  from: number,
  to: number,
  options: CommunityComposerExtensionOptions,
): Range<Decoration> {
  return Decoration.replace({
    widget: new CommunityMemberWidget(member, token, from, to, options),
  }).range(from, to);
}
