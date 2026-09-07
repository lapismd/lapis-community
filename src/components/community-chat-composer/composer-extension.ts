import { Prec, StateEffect, type Range } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
  keymap,
} from "@codemirror/view";
import {
  defineMiraExtension,
  type MiraExtension,
} from "@lapismd/mira/extensions";

import type { CommunityCustomEmoji } from "../../community/index.js";
import type {
  CommunityMemberModel,
  CommunityRoomModel,
} from "../community-workspace/model.js";
import {
  isFencedCodePosition,
  isInlineCodePosition,
  isSafeCommunityEmojiUrl,
} from "./model.js";
import {
  detectCommunityComposerAutocomplete,
  type CommunityComposerAutocompleteQuery,
} from "./autocomplete.js";

export interface CommunityComposerEditorState {
  view: EditorView;
  selectionFrom: number;
  selectionTo: number;
}

export interface CommunityComposerExtensionOptions {
  members(): readonly CommunityMemberModel[];
  rooms(): readonly CommunityRoomModel[];
  emojis(): readonly CommunityCustomEmoji[];
  disabled(): boolean;
  editing(): boolean;
  autocompleteOpen(): boolean;
  onOpenMember():
    | ((member: CommunityMemberModel) => void | Promise<void>)
    | undefined;
  onMessageMember():
    | ((member: CommunityMemberModel) => void | Promise<void>)
    | undefined;
  onWaveMember():
    | ((member: CommunityMemberModel) => void | Promise<void>)
    | undefined;
  onView(view: EditorView): void;
  onSelection(state: CommunityComposerEditorState): void;
  onAutocompleteQuery(query: CommunityComposerAutocompleteQuery | null): void;
  onAutocompleteMove(direction: -1 | 1): void;
  onAutocompleteAccept(): boolean;
  onAutocompleteDismiss(): void;
  onSubmit(): void;
  onEditLast(): boolean;
  onCancelEdit(): void;
}

const refreshCommunityComposerTokens = StateEffect.define<void>();

export function createCommunityComposerExtension(
  options: CommunityComposerExtensionOptions,
): MiraExtension {
  return defineMiraExtension({
    name: "community-chat-composer",
    codeMirror: () => [
      communityTokenDecorations(options),
      EditorView.updateListener.of((update) => {
        if (!update.selectionSet && !update.docChanged) return;
        const selection = update.state.selection.main;
        options.onSelection({
          view: update.view,
          selectionFrom: selection.from,
          selectionTo: selection.to,
        });
        updateAutocompleteQuery(update.view, options);
      }),
      Prec.highest(
        keymap.of([
          {
            key: "Enter",
            run(view) {
              if (options.autocompleteOpen())
                return options.onAutocompleteAccept();
              if (view.composing || options.disabled()) return false;
              if (
                isFencedCodePosition(
                  view.state.doc.toString(),
                  view.state.selection.main.head,
                )
              ) {
                return false;
              }
              options.onSubmit();
              return true;
            },
          },
          {
            key: "Tab",
            run() {
              return options.autocompleteOpen()
                ? options.onAutocompleteAccept()
                : false;
            },
          },
          {
            key: "ArrowDown",
            run() {
              if (!options.autocompleteOpen()) return false;
              options.onAutocompleteMove(1);
              return true;
            },
          },
          {
            key: "ArrowUp",
            run(view) {
              if (options.autocompleteOpen()) {
                options.onAutocompleteMove(-1);
                return true;
              }
              if (
                view.state.doc.toString().trim() !== "" ||
                view.state.selection.main.head !== 0
              ) {
                return false;
              }
              return options.onEditLast();
            },
          },
          {
            key: "Escape",
            run() {
              if (options.autocompleteOpen()) {
                options.onAutocompleteDismiss();
                return true;
              }
              if (!options.editing()) return false;
              options.onCancelEdit();
              return true;
            },
          },
        ]),
      ),
    ],
    onMount(context) {
      if (!(context.view instanceof EditorView)) return;
      options.onView(context.view);
      const selection = context.view.state.selection.main;
      options.onSelection({
        view: context.view,
        selectionFrom: selection.from,
        selectionTo: selection.to,
      });
      updateAutocompleteQuery(context.view, options);
    },
  });
}

function updateAutocompleteQuery(
  view: EditorView,
  options: CommunityComposerExtensionOptions,
): void {
  const selection = view.state.selection.main;
  const value = view.state.doc.toString();
  if (
    !selection.empty ||
    isFencedCodePosition(value, selection.head) ||
    isInlineCodePosition(value, selection.head)
  ) {
    options.onAutocompleteQuery(null);
    return;
  }
  options.onAutocompleteQuery(
    detectCommunityComposerAutocomplete(
      value,
      selection.head,
      options.members(),
    ),
  );
}

function communityTokenDecorations(options: CommunityComposerExtensionOptions) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildTokenDecorations(view, options);
      }

      update(update: ViewUpdate): void {
        const tokenModelChanged = update.transactions.some((transaction) =>
          transaction.effects.some((effect) =>
            effect.is(refreshCommunityComposerTokens),
          ),
        );
        if (
          !update.docChanged &&
          !update.viewportChanged &&
          !update.selectionSet &&
          !tokenModelChanged
        ) {
          return;
        }
        this.decorations = buildTokenDecorations(update.view, options);
      }
    },
    { decorations: (value) => value.decorations },
  );
}

function buildTokenDecorations(
  view: EditorView,
  options: CommunityComposerExtensionOptions,
): DecorationSet {
  const value = view.state.doc.toString();
  const normalizedValue = value.toLocaleLowerCase();
  const decorated: Array<{ from: number; to: number }> = [];
  const ranges: Range<Decoration>[] = [];

  for (const match of value.matchAll(/\|\|[^|\n]+\|\|/gu)) {
    const from = match.index;
    const to = from + match[0].length;
    decorated.push({ from, to });
    ranges.push(
      Decoration.mark({
        class: "community-composer-token community-composer-token--spoiler",
      }).range(from, to),
    );
  }

  for (const match of communityEmojiMatches(value, options.emojis())) {
    if (
      decorated.some(
        (range) => match.from < range.to && match.to > range.from,
      ) ||
      isFencedCodePosition(value, match.from) ||
      isInlineCodePosition(value, match.from) ||
      selectionTouchesRange(view, match.from, match.to)
    ) {
      continue;
    }
    decorated.push({ from: match.from, to: match.to });
    ranges.push(
      Decoration.replace({
        widget: new CommunityEmojiWidget(
          match.emoji.shortcode,
          match.emoji.url,
        ),
      }).range(match.from, match.to),
    );
  }

  const references = uniqueReferenceTokens(options).sort(
    (left, right) => right.token.length - left.token.length,
  );
  for (const reference of references) {
    const normalizedToken = reference.token.toLocaleLowerCase();
    let from = normalizedValue.indexOf(normalizedToken);
    while (from >= 0) {
      const to = from + reference.token.length;
      if (
        hasReferenceBoundary(value, from, reference.token) &&
        !decorated.some((range) => from < range.to && to > range.from)
      ) {
        decorated.push({ from, to });
        const member =
          reference.memberId === undefined
            ? undefined
            : options
                .members()
                .find((candidate) => candidate.id === reference.memberId);
        if (member !== undefined && !selectionTouchesRange(view, from, to)) {
          ranges.push(
            Decoration.replace({
              widget: new CommunityMemberWidget(
                member,
                reference.token,
                options,
              ),
            }).range(from, to),
          );
        } else {
          ranges.push(
            Decoration.mark({
              class: `community-composer-token community-composer-token--${reference.kind}`,
              ...(reference.memberId === undefined
                ? {}
                : {
                    attributes: {
                      "data-community-member-id": reference.memberId,
                    },
                  }),
            }).range(from, to),
          );
        }
      }
      from = normalizedValue.indexOf(normalizedToken, from + 1);
    }
  }

  return Decoration.set(
    ranges.sort((left, right) => left.from - right.from || left.to - right.to),
  );
}

export function refreshCommunityComposerTokenDecorations(
  view: EditorView,
): void {
  view.dispatch({ effects: refreshCommunityComposerTokens.of(undefined) });
}

class CommunityEmojiWidget extends WidgetType {
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

const memberWidgetCleanup = new WeakMap<HTMLElement, () => void>();

class CommunityMemberWidget extends WidgetType {
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
      other.member.avatarUrl === this.member.avatarUrl &&
      other.label === this.label
    );
  }

  override toDOM(): HTMLElement {
    const host = document.createElement("span");
    host.className = "community-composer-member-reference";
    host.dataset.uiPart = "composer-member-reference";
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "community-composer-member-reference__trigger";
    trigger.ariaLabel = this.label;
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.append(
      composerMemberAvatar(this.member, "inline"),
      Object.assign(document.createElement("span"), {
        textContent: this.label,
      }),
    );

    const popover = composerMemberPopover(this.member, this.options);
    document.body.append(popover);
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    let positioned = false;

    const positionPopover = () => {
      if (popover.hidden) return;
      const triggerBounds = trigger.getBoundingClientRect();
      const popoverBounds = popover.getBoundingClientRect();
      const edge = 8;
      const gap = 8;
      const right = triggerBounds.right + gap;
      const left = Math.min(
        Math.max(edge, right),
        window.innerWidth - popoverBounds.width - edge,
      );
      const below = triggerBounds.bottom + gap;
      const top =
        below + popoverBounds.height <= window.innerHeight - edge
          ? below
          : Math.max(edge, triggerBounds.top - popoverBounds.height - gap);
      popover.style.left = `${left}px`;
      popover.style.top = `${top}px`;
      positioned = true;
    };
    const showPopover = () => {
      if (hideTimer !== undefined) clearTimeout(hideTimer);
      hideTimer = undefined;
      popover.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      positionPopover();
      window.addEventListener("resize", positionPopover);
      window.addEventListener("scroll", positionPopover, true);
    };
    const hidePopover = () => {
      popover.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      window.removeEventListener("resize", positionPopover);
      window.removeEventListener("scroll", positionPopover, true);
    };
    const scheduleHide = () => {
      if (hideTimer !== undefined) clearTimeout(hideTimer);
      hideTimer = setTimeout(hidePopover, 120);
    };
    const cancelHide = () => {
      if (hideTimer !== undefined) clearTimeout(hideTimer);
      hideTimer = undefined;
    };
    const openProfile = () => {
      void this.options.onOpenMember()?.(this.member);
    };

    trigger.addEventListener("pointerenter", showPopover);
    trigger.addEventListener("pointerleave", scheduleHide);
    trigger.addEventListener("focus", showPopover);
    trigger.addEventListener("blur", scheduleHide);
    trigger.addEventListener("click", openProfile);
    popover.addEventListener("pointerenter", cancelHide);
    popover.addEventListener("pointerleave", scheduleHide);
    popover.addEventListener("focusin", cancelHide);
    popover.addEventListener("focusout", scheduleHide);
    host.append(trigger);

    memberWidgetCleanup.set(host, () => {
      if (hideTimer !== undefined) clearTimeout(hideTimer);
      if (positioned) hidePopover();
      popover.remove();
    });
    return host;
  }

  override destroy(dom: HTMLElement): void {
    memberWidgetCleanup.get(dom)?.();
    memberWidgetCleanup.delete(dom);
  }
}

function composerMemberAvatar(
  member: CommunityMemberModel,
  size: "inline" | "large",
): HTMLElement {
  const avatar = document.createElement("span");
  avatar.className = "community-composer-member-avatar";
  avatar.dataset.size = size;
  avatar.dataset.uiComponent = "community-member-avatar";
  avatar.setAttribute("aria-hidden", "true");
  if (member.avatarUrl === undefined) {
    avatar.textContent = member.initials;
  } else {
    const image = document.createElement("img");
    image.src = member.avatarUrl;
    image.alt = "";
    avatar.append(image);
  }
  return avatar;
}

function composerMemberPopover(
  member: CommunityMemberModel,
  options: CommunityComposerExtensionOptions,
): HTMLElement {
  const popover = document.createElement("div");
  popover.className = "community-composer-member-popover";
  popover.hidden = true;
  popover.role = "group";
  popover.ariaLabel = `${member.name} contact preview`;

  const identity = document.createElement("button");
  identity.type = "button";
  identity.className = "community-composer-member-popover__identity";
  identity.ariaLabel = `Open ${member.name}'s profile`;
  const copy = document.createElement("span");
  const name = document.createElement("strong");
  name.textContent = member.name;
  const handle = document.createElement("small");
  handle.textContent = `@${member.handle}`;
  copy.append(name, handle);
  identity.append(composerMemberAvatar(member, "large"), copy);
  identity.addEventListener("click", () => {
    void options.onOpenMember()?.(member);
  });
  popover.append(identity);

  if (member.role) {
    const role = document.createElement("p");
    role.className = "community-composer-member-popover__role";
    role.textContent = member.role;
    popover.append(role);
  }

  const actions = document.createElement("div");
  actions.className = "community-composer-member-popover__actions";
  const onMessage = options.onMessageMember();
  const onWave = options.onWaveMember();
  if (onMessage !== undefined) {
    actions.append(
      composerMemberAction(`Message ${member.name}`, "Message", () => {
        void onMessage(member);
      }),
    );
  }
  if (onWave !== undefined) {
    actions.append(
      composerMemberAction(`Wave to ${member.name}`, "Wave", () => {
        void onWave(member);
      }),
    );
  }
  if (actions.childElementCount > 0) popover.append(actions);
  return popover;
}

function composerMemberAction(
  label: string,
  text: string,
  action: () => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.ariaLabel = label;
  button.textContent = text;
  button.addEventListener("click", action);
  return button;
}

function communityEmojiMatches(
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

function selectionTouchesRange(
  view: EditorView,
  from: number,
  to: number,
): boolean {
  const selection = view.state.selection.main;
  return selection.empty
    ? selection.head > from && selection.head < to
    : selection.from < to && selection.to > from;
}

function uniqueReferenceTokens(
  options: CommunityComposerExtensionOptions,
): Array<{
  token: string;
  kind: "mention" | "channel" | "emoji";
  memberId?: string;
}> {
  const candidates = [
    ...options.members().map((member) => ({
      token: `@${member.name.trim()}`,
      kind: "mention" as const,
      memberId: member.id,
    })),
    ...options
      .rooms()
      .filter((room) => room.kind !== "direct" && room.archived !== true)
      .map((room) => ({
        token: `#${room.name.trim()}`,
        kind: "channel" as const,
      })),
    ...options
      .emojis()
      .filter((emoji) => isSafeCommunityEmojiUrl(emoji.url))
      .map((emoji) => ({
        token: `:${emoji.shortcode.trim()}:`,
        kind: "emoji" as const,
      })),
  ].filter((candidate) => candidate.token.length > 1);
  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    const normalized = candidate.token.toLocaleLowerCase();
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return candidates.filter(
    (candidate) => counts.get(candidate.token.toLocaleLowerCase()) === 1,
  );
}

function hasReferenceBoundary(
  value: string,
  index: number,
  token: string,
): boolean {
  if (token.startsWith(":")) return true;
  const before = value[index - 1] ?? "";
  const after = value[index + token.length] ?? "";
  return !/[\p{L}\p{N}_]/u.test(before) && !/[\p{L}\p{N}_-]/u.test(after);
}
