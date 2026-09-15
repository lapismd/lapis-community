export interface CommunityUploadedMedia {
  url: string;
  mimeType: string;
  size: number;
  sha256: string;
  name?: string;
  alt?: string;
  width?: number;
  height?: number;
}

export type CommunityComposerContext =
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
