import type { EditorView } from "@codemirror/view";

import type {
  CommunityComposerAutocompleteItem,
  CommunityComposerAutocompleteQuery,
} from "./autocomplete.js";
import { communityComposerAutocompleteInsert } from "./composer-mention-insert.js";
import { isComposerSlashCategory } from "./composer-slash-insert.js";

export function applyComposerAutocompleteSelection(input: {
  item: CommunityComposerAutocompleteItem;
  query: CommunityComposerAutocompleteQuery;
  view: EditorView;
}): { mentionId?: string; roomId?: string; keepOpen: boolean } | undefined {
  const insert = communityComposerAutocompleteInsert(input.item);
  if (insert === "") return undefined;
  input.view.dispatch({
    changes: { from: input.query.from, to: input.query.to, insert },
    selection: { anchor: input.query.from + insert.length },
  });
  return {
    ...(input.item.member ? { mentionId: input.item.member.id } : {}),
    ...(input.item.room ? { roomId: input.item.room.id } : {}),
    keepOpen: isComposerSlashCategory(input.item),
  };
}
