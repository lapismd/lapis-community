import type {
  TranscriptCommentPart,
  TranscriptSelection,
} from "../../protocol/transcript-comment-anchor.js";
import {
  checkpointIndex,
  type CheckpointEvents,
} from "../../projects/checkpoint-conversation.js";
import { transcriptRecordIdentity } from "../../projects/transcript-record-parts.js";
import { transcriptCommentTarget } from "../../projects/transcript-comments.js";
import type { TranscriptCommentSource } from "./transcript-comment-sources.js";

export interface TranscriptCommentDraft {
  source: TranscriptCommentSource;
  content: string;
  part?: TranscriptCommentPart;
  selection?: TranscriptSelection;
}
/** Whole-item live drafts follow identity; immutable or selected passages retain exact content. */
export function durableDraftTarget(
  events: CheckpointEvents,
  draft: TranscriptCommentDraft,
) {
  const { source } = draft;
  const index = checkpointIndex(events);
  for (const checkpoint of index.checkpoints) {
    if (
      checkpoint.authorPubkey !== source.agentPubkey ||
      checkpoint.live ||
      (source.checkpointEventId &&
        checkpoint.eventId !== source.checkpointEventId) ||
      (!source.checkpointEventId && !source.channelId) ||
      (source.channelId && checkpoint.channelId !== source.channelId)
    )
      continue;
    const target = transcriptCommentTarget(index, {
      checkpointEventId: checkpoint.eventId,
      recordId: source.record.id,
      ...(draft.part ? { part: draft.part } : {}),
      ...(draft.selection ? { selection: draft.selection } : {}),
    });
    if (
      !target ||
      (source.threadRootId && target.rootId !== source.threadRootId)
    )
      continue;
    const expected = transcriptRecordIdentity(source.record);
    const actual = transcriptRecordIdentity(target.record);
    if (
      expected.threadId !== actual.threadId ||
      expected.turnId !== actual.turnId ||
      expected.kind !== actual.kind
    )
      continue;
    if (
      draft.part?.startsWith("plan:") &&
      source.parts[draft.part] !== target.parts[draft.part]
    )
      continue;
    if (
      (source.checkpointEventId ||
        draft.selection ||
        (draft.part && !draft.part.startsWith("plan:"))) &&
      (Object.keys(source.parts).length !== Object.keys(target.parts).length ||
        Object.entries(source.parts).some(
          ([part, text]) => target.parts[part] !== text,
        ))
    )
      continue;
    return target;
  }
}
