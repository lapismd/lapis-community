import type { EditorView } from "@codemirror/view";

export function composerChipRemovalRange(
  text: string,
  from: number,
  to: number,
): { from: number; to: number } {
  return {
    from,
    to: text[to] === " " ? to + 1 : to,
  };
}

export function removeComposerChipRange(
  view: EditorView,
  from: number,
  to: number,
): void {
  const range = composerChipRemovalRange(view.state.doc.toString(), from, to);
  view.dispatch({
    changes: range,
    selection: { anchor: range.from },
  });
  view.focus();
}
