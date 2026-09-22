import { Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import {
  defineMiraExtension,
  type MiraExtension,
} from "@lapismd/mira/extensions";

import type { CommunityCustomEmoji } from "../../community/index.js";
import type {
  CommunityMemberModel,
  CommunityRoomModel,
} from "../community-workspace/model.js";
import { useCommunityEntityNavigation } from "../community-entity-chip/navigation.js";
import {
  detectCommunityComposerAutocomplete,
  type CommunityComposerAutocompleteQuery,
} from "./autocomplete.js";
import {
  communityTokenDecorations,
  refreshCommunityComposerTokens,
} from "./composer-decorations.js";
import { communityComposerPasteHandler } from "./composer-entity-links.js";
import { isFencedCodePosition, isInlineCodePosition } from "./model.js";

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

export function createCommunityComposerExtension(
  options: CommunityComposerExtensionOptions,
): MiraExtension {
  const navigation = useCommunityEntityNavigation();
  return defineMiraExtension({
    name: "community-chat-composer",
    codeMirror: () => [
      communityTokenDecorations(options, navigation),
      communityComposerPasteHandler(),
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

export function refreshCommunityComposerTokenDecorations(
  view: EditorView,
): void {
  view.dispatch({ effects: refreshCommunityComposerTokens.of(undefined) });
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
