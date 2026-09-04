import {
  acceptCompletion,
  autocompletion,
  completionStatus,
  startCompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
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
  onView(view: EditorView): void;
  onSelection(state: CommunityComposerEditorState): void;
  onMention(member: CommunityMemberModel): void;
  onChannel(room: CommunityRoomModel): void;
  onSubmit(): void;
  onEditLast(): boolean;
  onCancelEdit(): void;
}

const refreshCommunityComposerTokens = StateEffect.define<void>();

export function createCommunityComposerExtension(
  options: CommunityComposerExtensionOptions,
): MiraExtension {
  const autocompleteSource = (
    context: CompletionContext,
  ): CompletionResult | null => {
    const match = prefixMatch(context);
    if (match === null) return null;
    if (
      isFencedCodePosition(context.state.doc.toString(), context.pos) ||
      isInlineCodePosition(context.state.doc.toString(), context.pos)
    ) {
      return null;
    }

    const query = match.query.toLocaleLowerCase();
    const completions =
      match.prefix === "@"
        ? memberCompletions(options.members(), query, options.onMention)
        : match.prefix === "#"
          ? channelCompletions(options.rooms(), query, options.onChannel)
          : emojiCompletions(options.emojis(), query);
    if (completions.length === 0) return null;

    return {
      from: match.from,
      options: completions,
      filter: false,
    };
  };

  return defineMiraExtension({
    name: "community-chat-composer",
    codeMirror: () => [
      autocompletion({
        override: [autocompleteSource],
        interactionDelay: 0,
      }),
      communityTokenDecorations(options),
      EditorView.updateListener.of((update) => {
        if (!update.selectionSet && !update.docChanged) return;
        const selection = update.state.selection.main;
        options.onSelection({
          view: update.view,
          selectionFrom: selection.from,
          selectionTo: selection.to,
        });
      }),
      Prec.highest(
        keymap.of([
          {
            key: "Enter",
            run(view) {
              if (completionStatus(view.state) !== null) {
                return acceptCompletion(view);
              }
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
            run(view) {
              return completionStatus(view.state) === null
                ? false
                : acceptCompletion(view);
            },
          },
          {
            key: "ArrowUp",
            run(view) {
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
    },
  });
}

export function openCommunityComposerAutocomplete(view: EditorView): void {
  startCompletion(view);
}

function prefixMatch(context: CompletionContext): {
  prefix: "@" | "#" | ":";
  query: string;
  from: number;
} | null {
  const line = context.state.doc.lineAt(context.pos);
  const before = context.state.sliceDoc(line.from, context.pos);
  const match = /(?:^|\s)([@#:])([\p{L}\p{N}_+-]*)$/u.exec(before);
  const prefix = match?.[1];
  if (prefix !== "@" && prefix !== "#" && prefix !== ":") return null;
  const query = match?.[2] ?? "";
  return {
    prefix,
    query,
    from: context.pos - query.length - 1,
  };
}

function memberCompletions(
  members: readonly CommunityMemberModel[],
  query: string,
  onMention: (member: CommunityMemberModel) => void,
): Completion[] {
  return members
    .filter((member) =>
      `${member.name} ${member.handle}`.toLocaleLowerCase().includes(query),
    )
    .slice(0, 8)
    .map((member) => ({
      label: `@${member.name}`,
      detail: `@${member.handle}`,
      type: "variable",
      apply(view, _completion, from, to) {
        const insert = `@${member.name} `;
        view.dispatch({
          changes: { from, to, insert },
          selection: { anchor: from + insert.length },
        });
        onMention(member);
      },
    }));
}

function channelCompletions(
  rooms: readonly CommunityRoomModel[],
  query: string,
  onChannel: (room: CommunityRoomModel) => void,
): Completion[] {
  return rooms
    .filter(
      (room) =>
        room.kind !== "direct" &&
        room.archived !== true &&
        room.name.toLocaleLowerCase().includes(query),
    )
    .slice(0, 8)
    .map((room) => ({
      label: `#${room.name}`,
      detail: room.kind === "forum" ? "Forum" : "Channel",
      type: "namespace",
      apply(view, _completion, from, to) {
        const insert = `#${room.name} `;
        view.dispatch({
          changes: { from, to, insert },
          selection: { anchor: from + insert.length },
        });
        onChannel(room);
      },
    }));
}

function emojiCompletions(
  emojis: readonly CommunityCustomEmoji[],
  query: string,
): Completion[] {
  return emojis
    .filter((emoji) => emoji.shortcode.toLocaleLowerCase().includes(query))
    .slice(0, 8)
    .map((emoji) => ({
      label: `:${emoji.shortcode}:`,
      detail: "Community emoji",
      type: "keyword",
      apply: `:${emoji.shortcode}: `,
    }));
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
        ranges.push(
          Decoration.mark({
            class: `community-composer-token community-composer-token--${reference.kind}`,
          }).range(from, to),
        );
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
): Array<{ token: string; kind: "reference" | "emoji" }> {
  const candidates = [
    ...options.members().map((member) => ({
      token: `@${member.name.trim()}`,
      kind: "reference" as const,
    })),
    ...options
      .rooms()
      .filter((room) => room.kind !== "direct" && room.archived !== true)
      .map((room) => ({
        token: `#${room.name.trim()}`,
        kind: "reference" as const,
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
