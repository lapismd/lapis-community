import type {
  CommunityComposerAutocompleteItem,
  CommunityComposerAutocompleteQuery,
} from "./autocomplete.js";

export function composerAutocompleteQueryEquals(
  current: CommunityComposerAutocompleteQuery | undefined,
  next: CommunityComposerAutocompleteQuery | null,
): boolean {
  if (next == null) return current === undefined;
  return (
    current !== undefined &&
    current.kind === next.kind &&
    current.query === next.query &&
    current.from === next.from &&
    current.to === next.to
  );
}

export function composerAutocompleteItemsEqual(
  current: readonly CommunityComposerAutocompleteItem[],
  next: readonly CommunityComposerAutocompleteItem[],
): boolean {
  if (current.length !== next.length) return false;
  return current.every((item, index) => {
    const candidate = next[index];
    return (
      candidate !== undefined &&
      item.id === candidate.id &&
      item.label === candidate.label &&
      item.detail === candidate.detail
    );
  });
}

export function shouldSkipComposerAutocompleteUpdate(
  currentQuery: CommunityComposerAutocompleteQuery | undefined,
  nextQuery: CommunityComposerAutocompleteQuery | null,
  currentItems: readonly CommunityComposerAutocompleteItem[],
  nextItems: readonly CommunityComposerAutocompleteItem[] | undefined,
): boolean {
  if (!composerAutocompleteQueryEquals(currentQuery, nextQuery)) return false;
  if (nextQuery?.kind === "emoji") return true;
  return (
    nextItems !== undefined &&
    composerAutocompleteItemsEqual(currentItems, nextItems)
  );
}

export function composerActiveActionsEqual(
  current: ReadonlySet<string>,
  next: ReadonlySet<string>,
): boolean {
  if (current.size !== next.size) return false;
  for (const action of next) {
    if (!current.has(action)) return false;
  }
  return true;
}
