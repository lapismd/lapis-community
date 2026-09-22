export function compareAutocompleteMatch(
  left: string,
  right: string,
  query: string,
): number {
  const normalizedLeft = left.toLocaleLowerCase();
  const normalizedRight = right.toLocaleLowerCase();
  const leftPrefix = normalizedLeft.startsWith(query) ? 0 : 1;
  const rightPrefix = normalizedRight.startsWith(query) ? 0 : 1;
  return (
    leftPrefix - rightPrefix || normalizedLeft.localeCompare(normalizedRight)
  );
}

export function compactEmojiShortcode(value: string): string {
  return value.toLocaleLowerCase().replace(/[_+\-\s]/gu, "");
}
