import type { Snippet } from "svelte";
import type {
  CommunityCustomEmoji,
  CommunityMessageReport,
} from "../../community/index.js";
import type {
  CommunityEmojiReference,
  CommunityMemberModel,
  CommunityMessageModel,
  CommunityRoomModel,
} from "../community-workspace/model.js";
export type CommunityMessageProps = {
  message: CommunityMessageModel;
  author: CommunityMemberModel;
  members?: readonly CommunityMemberModel[];
  rooms?: readonly CommunityRoomModel[];
  isContinuation?: boolean;
  highlighted?: boolean;
  replyParticipants?: CommunityMemberModel[];
  communityEmojis?: readonly CommunityCustomEmoji[];
  reactionOptions?: readonly string[];
  density?: "compact" | "balanced" | "spacious";
  onReply?: (messageId: string) => void;
  onOpenThread?: (messageId: string) => void;
  onToggleReaction?: (
    messageId: string,
    emoji: string,
    customEmoji?: CommunityEmojiReference,
  ) => void | Promise<void>;
  onAddReaction?: (
    messageId: string,
    emoji: string,
    customEmoji?: CommunityEmojiReference,
  ) => void | Promise<void>;
  onCopyLink?: (messageId: string) => void;
  onCopyMessage?: (messageId: string) => void;
  onCopyEvent?: (messageId: string) => void;
  onEdit?: (messageId: string) => void | Promise<void>;
  onDelete?: (messageId: string) => void | Promise<void>;
  onReport?: (
    messageId: string,
    report: CommunityMessageReport,
  ) => void | Promise<void>;
  onOpenProfile?: (member: CommunityMemberModel) => void;
  onOpenRoom?: (roomId: string) => void;
  onMessageMember?: (member: CommunityMemberModel) => void | Promise<void>;
  onWaveMember?: (member: CommunityMemberModel) => void | Promise<void>;
  onViewMemberActivity?: (member: CommunityMemberModel) => void | Promise<void>;
  currentMemberId?: string;
  replyActionLabel?: string;
  supplement?: Snippet;
  avatarShape?: "circle" | "rounded";
};
