import type { EditorView } from "@codemirror/view";
import type { MiraMarkdownActionId } from "@lapismd/mira";

import { composerActiveActionsEqual } from "./composer-autocomplete-sync.js";

const INLINE_ACTIONS: readonly MiraMarkdownActionId[] = [
  "bold",
  "italic",
  "strikethrough",
  "inlineCode",
  "link",
];

export function nextComposerActiveActions(
  view: EditorView,
  current: ReadonlySet<MiraMarkdownActionId>,
): ReadonlySet<MiraMarkdownActionId> | undefined {
  const next = new Set(
    INLINE_ACTIONS.filter((action) => isSelectionFormatted(view, action)),
  );
  if (composerActiveActionsEqual(current, next)) return undefined;
  return next;
}

function isSelectionFormatted(
  view: EditorView,
  action: MiraMarkdownActionId,
): boolean {
  const selection = view.state.selection.main;
  if (selection.empty) return false;
  const selected = view.state.sliceDoc(selection.from, selection.to);
  const delimiters =
    action === "bold"
      ? [
          ["**", "**"],
          ["__", "__"],
        ]
      : action === "italic"
        ? [
            ["*", "*"],
            ["_", "_"],
          ]
        : action === "strikethrough"
          ? [["~~", "~~"]]
          : action === "inlineCode"
            ? [["`", "`"]]
            : [];
  if (action === "link") {
    const before = view.state.sliceDoc(
      Math.max(0, selection.from - 1),
      selection.from,
    );
    const after = view.state.sliceDoc(
      selection.to,
      Math.min(view.state.doc.length, selection.to + 2),
    );
    return before === "[" && after === "](";
  }
  return delimiters.some(([open, close]) => {
    if (!open || !close) return false;
    if (selected.startsWith(open) && selected.endsWith(close)) return true;
    return (
      view.state.sliceDoc(
        Math.max(0, selection.from - open.length),
        selection.from,
      ) === open &&
      view.state.sliceDoc(
        selection.to,
        Math.min(view.state.doc.length, selection.to + close.length),
      ) === close
    );
  });
}
