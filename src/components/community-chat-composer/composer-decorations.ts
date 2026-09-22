import { StateEffect, type Range } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";

import type { CommunityEntityNavigation } from "../community-entity-chip/navigation.js";
import { communityComposerEntityMatches } from "./composer-entity-links.js";
import type { CommunityComposerExtensionOptions } from "./composer-extension.js";
import {
  communityComposerReferenceTokens,
  composerTokenMember,
  hasComposerReferenceBoundary,
} from "./composer-token-references.js";
import {
  CommunityEmojiWidget,
  CommunityEntityWidget,
  CommunityMemberWidget,
  communityEmojiMatches,
} from "./composer-widgets.js";
import { isFencedCodePosition, isInlineCodePosition } from "./model.js";

export const refreshCommunityComposerTokens = StateEffect.define<void>();

export function communityTokenDecorations(
  options: CommunityComposerExtensionOptions,
  navigation?: CommunityEntityNavigation,
) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildTokenDecorations(view, options, navigation);
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
        this.decorations = buildTokenDecorations(
          update.view,
          options,
          navigation,
        );
      }
    },
    { decorations: (value) => value.decorations },
  );
}

function buildTokenDecorations(
  view: EditorView,
  options: CommunityComposerExtensionOptions,
  navigation?: CommunityEntityNavigation,
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
    if (skipComposerRange(view, value, decorated, match.from, match.to)) {
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

  for (const match of communityComposerEntityMatches(value)) {
    if (skipComposerRange(view, value, decorated, match.from, match.to)) {
      continue;
    }
    decorated.push({ from: match.from, to: match.to });
    ranges.push(
      Decoration.replace({
        widget: new CommunityEntityWidget(match.link, match.href, navigation),
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

function skipComposerRange(
  view: EditorView,
  value: string,
  decorated: readonly { from: number; to: number }[],
  from: number,
  to: number,
): boolean {
  return (
    decorated.some((range) => from < range.to && to > range.from) ||
    isFencedCodePosition(value, from) ||
    isInlineCodePosition(value, from) ||
    selectionTouchesRange(view, from, to)
  );
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
