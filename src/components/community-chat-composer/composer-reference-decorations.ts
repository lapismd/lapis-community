import { type Range } from "@codemirror/state";
import { Decoration, type EditorView } from "@codemirror/view";

import type { CommunityEntityNavigation } from "../community-entity-chip/navigation.js";
import type { CommunityComposerExtensionOptions } from "./composer-extension.js";
import {
  communityChannelChipDecoration,
  communityMemberChipDecoration,
} from "./composer-chip-widgets.js";
import { composerTokenRoom } from "./composer-room-tokens.js";
import {
  communityComposerReferenceTokens,
  composerTokenMember,
  hasComposerReferenceBoundary,
  type CommunityComposerReferenceToken,
} from "./composer-token-references.js";

export function pushComposerReferenceDecorations(
  view: EditorView,
  options: CommunityComposerExtensionOptions,
  value: string,
  decorated: Array<{ from: number; to: number }>,
  ranges: Range<Decoration>[],
  navigation?: CommunityEntityNavigation,
): void {
  const normalizedValue = value.toLocaleLowerCase();
  const references = communityComposerReferenceTokens(
    options.members(),
    options.rooms(),
    options.emojis(),
    options.preferredMemberIds(),
    value,
  ).sort((left, right) => right.token.length - left.token.length);
  for (const reference of references) {
    pushReferenceMatches(
      view,
      options,
      value,
      normalizedValue,
      reference,
      decorated,
      ranges,
      navigation,
    );
  }
}

function pushReferenceMatches(
  view: EditorView,
  options: CommunityComposerExtensionOptions,
  value: string,
  normalizedValue: string,
  reference: CommunityComposerReferenceToken,
  decorated: Array<{ from: number; to: number }>,
  ranges: Range<Decoration>[],
  navigation?: CommunityEntityNavigation,
): void {
  const normalizedToken = reference.token.toLocaleLowerCase();
  let from = normalizedValue.indexOf(normalizedToken);
  while (from >= 0) {
    const to = from + reference.token.length;
    if (
      hasComposerReferenceBoundary(value, from, reference.token) &&
      !decorated.some((range) => from < range.to && to > range.from)
    ) {
      decorated.push({ from, to });
      ranges.push(
        referenceDecoration(view, options, reference, from, to, navigation),
      );
    }
    from = normalizedValue.indexOf(normalizedToken, from + 1);
  }
}

function referenceDecoration(
  view: EditorView,
  options: CommunityComposerExtensionOptions,
  reference: CommunityComposerReferenceToken,
  from: number,
  to: number,
  navigation?: CommunityEntityNavigation,
): Range<Decoration> {
  const member = composerTokenMember(
    reference.memberId,
    options.members(),
    reference.token,
  );
  if (member !== undefined && !selectionTouchesRange(view, from, to)) {
    return communityMemberChipDecoration(
      member,
      reference.token,
      from,
      to,
      options,
    );
  }
  const room = composerTokenRoom(reference.roomId, options.rooms());
  if (room !== undefined && !selectionTouchesRange(view, from, to)) {
    return communityChannelChipDecoration(room, from, to, navigation);
  }
  return Decoration.mark({
    class: `community-composer-token community-composer-token--${reference.kind}`,
    ...(reference.memberId === undefined
      ? {}
      : {
          attributes: {
            "data-community-member-id": reference.memberId,
          },
        }),
  }).range(from, to);
}

export function selectionTouchesRange(
  view: EditorView,
  from: number,
  to: number,
): boolean {
  const selection = view.state.selection.main;
  return selection.empty
    ? selection.head > from && selection.head < to
    : selection.from < to && selection.to > from;
}
