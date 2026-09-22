import type { CommunityComposerAutocompleteItem } from "./autocomplete.js";
import { composerSlashCategoryRewrite } from "./composer-slash.js";
import {
  composerSlashItemHref,
  composerSlashItemKind,
} from "./composer-slash-catalog.js";

export function composerSlashInsert(
  item: CommunityComposerAutocompleteItem,
): string {
  const kind = composerSlashItemKind(item);
  if (kind) return composerSlashCategoryRewrite(kind);
  const href = composerSlashItemHref(item);
  return href ? `${href} ` : "";
}

export function isComposerSlashCategory(
  item: CommunityComposerAutocompleteItem,
): boolean {
  return composerSlashItemKind(item) !== undefined;
}
