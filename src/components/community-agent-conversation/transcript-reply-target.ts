import type { CommunityReplyTarget } from "../../community/contracts.js";
import type { TranscriptCommentPart } from "../../protocol/transcript-comment-anchor.js";
import type { NostrEvent } from "../../protocol/index.js";
import type { TranscriptCommentSource } from "./transcript-comment-sources.js";

/** Record identity is separate from signed event identity. */
export type ConversationComposerTarget =
  | { kind: "message"; target: CommunityReplyTarget }
  | {
      kind: "transcript";
      key: string;
      source: TranscriptCommentSource;
      part?: TranscriptCommentPart;
      rootId: string;
      channelId: string;
      excerpt: string;
    }
  | {
      kind: "comment";
      key: string;
      event: NostrEvent;
      rootId: string;
      channelId: string;
    };
export type TranscriptReplyTarget = Exclude<
  ConversationComposerTarget,
  { kind: "message" }
>;
export const transcriptReplyKey = (
  source: TranscriptCommentSource,
  part?: TranscriptCommentPart,
) => JSON.stringify([source.key, part ?? null]);
