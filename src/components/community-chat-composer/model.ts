import type {
  CommunityCustomEmoji,
  CommunityReplyTarget,
} from "../../community/index.js";
import type {
  CommunityMemberModel,
  CommunityRoomModel,
} from "../community-workspace/model.js";

export type CommunityComposerAttachmentStatus =
  | "queued"
  | "uploading"
  | "uploaded"
  | "failed";

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

export interface CommunityComposerAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  status: CommunityComposerAttachmentStatus;
  progress?: number;
  previewUrl?: string;
  spoiler?: boolean;
  error?: string;
  uploaded?: CommunityUploadedMedia;
}

export interface CommunityComposerDraft {
  value: string;
  mentionPubkeys: readonly string[];
  channelIds: readonly string[];
  attachments: readonly CommunityComposerAttachment[];
  updatedAt: number;
}

export interface CommunityComposerDraftStore {
  load(key: string): Promise<CommunityComposerDraft | undefined>;
  save(key: string, draft: CommunityComposerDraft): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface CommunityMessageMediaAdapter {
  upload(
    file: File,
    options: {
      signal: AbortSignal;
      onProgress(progress: number): void;
    },
  ): Promise<CommunityUploadedMedia>;
  remove?(media: CommunityUploadedMedia): Promise<void> | void;
}

export type CommunityComposerContext =
  | {
      kind: "reply";
      target: CommunityReplyTarget;
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

export interface CommunityComposerReferences {
  mentionPubkeys: readonly string[];
  channelIds: readonly string[];
}

export function resolveCommunityComposerReferences(
  value: string,
  members: readonly CommunityMemberModel[],
  rooms: readonly CommunityRoomModel[],
  selectedMentionPubkeys: readonly string[] = [],
  selectedChannelIds: readonly string[] = [],
  currentMemberId?: string,
): CommunityComposerReferences {
  const selectedMentions = new Set(selectedMentionPubkeys);
  const selectedChannels = new Set(selectedChannelIds);
  const uniqueMembers = uniqueByToken(members, (member) => member.name);
  const uniqueRooms = uniqueByToken(
    rooms.filter((room) => room.kind !== "direct" && room.archived !== true),
    (room) => room.name,
  );

  const mentionPubkeys = members
    .filter(
      (member) =>
        member.id !== currentMemberId &&
        tokenAppears(value, "@", member.name) &&
        (selectedMentions.has(member.id) || uniqueMembers.has(member.id)),
    )
    .map((member) => member.id);
  const channelIds = rooms
    .filter(
      (room) =>
        room.kind !== "direct" &&
        room.archived !== true &&
        tokenAppears(value, "#", room.name) &&
        (selectedChannels.has(room.id) || uniqueRooms.has(room.id)),
    )
    .map((room) => room.id);

  return {
    mentionPubkeys: [...new Set(mentionPubkeys)],
    channelIds: [...new Set(channelIds)],
  };
}

export function tokenAppears(
  value: string,
  prefix: "@" | "#",
  label: string,
): boolean {
  const escaped = escapeRegExp(label.trim());
  if (escaped === "") return false;
  return new RegExp(
    `(^|[^\\p{L}\\p{N}_])${escapeRegExp(prefix)}${escaped}(?![\\p{L}\\p{N}_-])`,
    "iu",
  ).test(value);
}

export function isFencedCodePosition(value: string, offset: number): boolean {
  const before = value.slice(0, Math.max(0, offset));
  const fences = before.match(/^\s*```/gmu)?.length ?? 0;
  return fences % 2 === 1;
}

export function isInlineCodePosition(value: string, offset: number): boolean {
  const lineStart = value.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
  const before = value.slice(lineStart, Math.max(lineStart, offset));
  return (before.match(/(?<!`)`(?!`)/gu)?.length ?? 0) % 2 === 1;
}

export function isSafeCommunityLink(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return false;
  if (/^(?:\/|\.\/|\.\.\/|#)/u.test(trimmed)) return true;
  try {
    const url = new URL(trimmed);
    return ["http:", "https:", "mailto:", "nostr:"].includes(url.protocol);
  } catch {
    return false;
  }
}

export function isSafeCommunityEmojiUrl(value: string): boolean {
  const trimmed = value.trim();
  if (/^data:image\/[a-z0-9.+-]+(?:;[^,]*)?,/iu.test(trimmed)) return true;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function formatCommunityAttachmentSize(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_024 * 1_024) return `${Math.round(bytes / 1_024)} KB`;
  return `${(bytes / (1_024 * 1_024)).toFixed(1)} MB`;
}

export function communityEmojiToken(
  emoji: string,
  custom?: CommunityCustomEmoji,
): string {
  return custom === undefined ? emoji : `:${custom.shortcode}:`;
}

function uniqueByToken<T extends { id: string }>(
  values: readonly T[],
  label: (value: T) => string,
): Set<string> {
  const idsByToken = new Map<string, string[]>();
  for (const value of values) {
    const token = label(value).trim().toLocaleLowerCase();
    if (token === "") continue;
    idsByToken.set(token, [...(idsByToken.get(token) ?? []), value.id]);
  }
  return new Set(
    [...idsByToken.values()]
      .filter((ids) => ids.length === 1)
      .flatMap((ids) => ids),
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
