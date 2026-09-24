import type { CommunityUploadedMedia } from "./composer-media.js";
export type { CommunityUploadedMedia } from "./composer-media.js";

export type CommunityComposerContext =
  | {
      kind: "transcript-reply";
      target: { authorName: string; content: string };
    }
  | {
      kind: "reply";
      target: import("./contracts.js").CommunityReplyTarget;
    }
  | {
      kind: "edit";
      id: string;
      label?: string;
    };

export interface CommunityComposerSubmission {
  content: string;
  mentionPubkeys: readonly string[];
  channelIds: readonly string[];
  attachments: readonly CommunityUploadedMedia[];
  context?: CommunityComposerContext;
}
