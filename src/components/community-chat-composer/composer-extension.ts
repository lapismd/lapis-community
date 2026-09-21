import { mount, unmount } from "svelte";
import CommunityComposerMemberReference from "./CommunityComposerMemberReference.svelte";
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
import {
  communityComposerReferenceTokens,
  composerTokenMember,
  hasComposerReferenceBoundary,
} from "./composer-token-references.js";

export interface CommunityComposerEditorState {
  view: EditorView;
  selectionFrom: number;
  selectionTo: number;
}

export interface CommunityComposerExtensionOptions {
  members(): readonly CommunityMemberModel[];
  rooms(): readonly CommunityRoomModel[];
  emojis(): readonly CommunityCustomEmoji[];
  preferredMemberIds(): readonly string[];
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
  submitOnEnter?(): boolean;
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
              if (options.submitOnEnter?.() === false) return false;
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

  const references = communityComposerReferenceTokens(
    options.members(),
    options.rooms(),
    options.emojis(),
    options.preferredMemberIds(),
    value,
  ).sort((left, right) => right.token.length - left.token.length);
  for (const reference of references) {
    const normalizedToken = reference.token.toLocaleLowerCase();
    let from = normalizedValue.indexOf(normalizedToken);
    while (from >= 0) {
      const to = from + reference.token.length;
      if (
        hasComposerReferenceBoundary(value, from, reference.token) &&
        !decorated.some((range) => from < range.to && to > range.from)
      ) {
        decorated.push({ from, to });
        const member = composerTokenMember(
          reference.memberId,
          options.members(),
          reference.token,
        );
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
    memberWidgetCleanup.set(host, () => {
      void unmount(component);
    });
    return host;
  }

  override destroy(dom: HTMLElement): void {
    memberWidgetCleanup.get(dom)?.();
    memberWidgetCleanup.delete(dom);
  }
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
