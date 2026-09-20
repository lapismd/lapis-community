import type { ComposerStatus } from "@lapismd/design-core/ai/chat";
import type {
  CommunityCustomEmoji,
  CommunityMessageReport,
  CommunityReplyTarget,
  CommunityHistoryState,
  CommunityTimelinePresentation,
  CommunityTimelinePosition,
} from "../../community/index.js";
import type {
  CommunityMemberModel,
  CommunityRoomModel,
  CommunityThreadModel,
} from "../community-workspace/model.js";

import type { CommunityAgentActivityContext } from "../../community/agent-contracts.js";
export type ThreadPanelProps = {
  activityContext?: CommunityAgentActivityContext;
  virtualize?: boolean;
  history?: CommunityHistoryState;
  presentation?: CommunityTimelinePresentation;
  onPresentationChange?: (
    key: string,
    update: { draft?: string; position?: CommunityTimelinePosition },
  ) => void;
  onLoadOlder?: () => Promise<void>;
  onLoadLatest?: () => Promise<void>;
  readBoundary?: { key: string; onRead?: () => void };
  thread: CommunityThreadModel;
  members: CommunityMemberModel[];
  rooms?: readonly CommunityRoomModel[];
  onSendReply?: (
    rootMessageId: string,
    content: string,
  ) => void | Promise<void>;
  onToggleReaction?: (
    messageId: string,
    emoji: string,
    custom?: { shortcode: string; url: string },
  ) => void | Promise<void>;
  onAddReaction?: (
    messageId: string,
    emoji: string,
    custom?: { shortcode: string; url: string },
  ) => void | Promise<void>;
  onCopyMessageLink?: (messageId: string) => void;
  onCopyMessage?: (messageId: string) => void;
  onCopyEvent?: (messageId: string) => void;
  onEditMessage?: (messageId: string) => void | Promise<void>;
  onSaveMessageEdit?: (
    messageId: string,
    content: string,
  ) => void | Promise<void>;
  onDeleteMessage?: (messageId: string) => void | Promise<void>;
  onReportMessage?: (
    messageId: string,
    report: CommunityMessageReport,
  ) => void | Promise<void>;
  onReply?: (messageId: string) => void;
  onOpenProfile?: (member: CommunityMemberModel) => void;
  onOpenRoom?: (roomId: string) => void;
  onMessageMember?: (member: CommunityMemberModel) => void | Promise<void>;
  onWaveMember?: (member: CommunityMemberModel) => void | Promise<void>;
  onViewMemberActivity?: (member: CommunityMemberModel) => void | Promise<void>;
  replyTarget?: CommunityReplyTarget;
  focusMessageId?: string | undefined;
  communityEmojis?: readonly CommunityCustomEmoji[];
  onCancelReply?: () => void;
  disabled?: boolean;
  disabledReason?: string;
  composerStatus?: ComposerStatus;
  onRetryComposerStatus?: () => void | Promise<void>;
  onDismissComposerStatus?: () => void;
  currentMemberId?: string;
  canDeleteAny?: boolean;
};
