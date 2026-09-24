import type { TranscriptCommentDraft } from "./transcript-comment-draft.js";
/** Application-owned drafts survive transcript and route remounts. */
export function createTranscriptCommentDrafts() {
  let drafts = $state.raw<Record<string, TranscriptCommentDraft>>({});
  return {
    get(key: string) {
      return drafts[key];
    },
    save(key: string, draft: TranscriptCommentDraft) {
      drafts = { ...drafts, [key]: draft };
    },
    remove(key: string) {
      const next = { ...drafts };
      delete next[key];
      drafts = next;
    },
  };
}
