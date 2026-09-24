import {
  formatCommunityAttachmentSize,
  type CommunityComposerAttachment,
} from "./model.js";

export function revokePreview(attachment: CommunityComposerAttachment): void {
  if (attachment.previewUrl?.startsWith("blob:")) {
    URL.revokeObjectURL(attachment.previewUrl);
  }
}

export function attachmentStatusLabel(
  attachment: CommunityComposerAttachment,
): string {
  if (attachment.status === "uploading") {
    return `Uploading ${Math.round(attachment.progress ?? 0)}%`;
  }
  if (attachment.status === "failed") {
    return attachment.error ?? "Upload failed";
  }
  if (attachment.status === "uploaded") {
    return `Ready, ${formatCommunityAttachmentSize(attachment.size)}`;
  }
  return `Waiting, ${formatCommunityAttachmentSize(attachment.size)}`;
}
