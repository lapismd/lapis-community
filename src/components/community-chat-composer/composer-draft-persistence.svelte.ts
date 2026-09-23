import { onDestroy } from "svelte";
import { createComposerDraftWriter } from "./composer-draft-writer.js";
import type {
  CommunityComposerDraft,
  CommunityComposerDraftStore,
} from "./model.js";

export function persistComposerDraft(
  read: () =>
    | {
        store: CommunityComposerDraftStore;
        key: string;
        draft: Omit<CommunityComposerDraft, "updatedAt">;
        retainEmpty: boolean;
      }
    | undefined,
) {
  const writer = createComposerDraftWriter();
  $effect(() => {
    const current = read();
    if (!current) return;
    const { store, key, retainEmpty } = current;
    const draft = {
      ...current.draft,
      attachments: current.draft.attachments.map((attachment) => {
        const { previewUrl: _previewUrl, ...persisted } = attachment;
        return {
          ...persisted,
          ...(attachment.uploaded?.url
            ? { previewUrl: attachment.uploaded.url }
            : {}),
        };
      }),
    };
    writer.schedule(() => {
      const write =
        !draft.value.trim() && draft.attachments.length === 0 && !retainEmpty
          ? store.remove(key)
          : store.save(key, { ...draft, updatedAt: Date.now() });
      void write.catch(() => {});
    });
  });
  onDestroy(writer.flush);
  return writer;
}
