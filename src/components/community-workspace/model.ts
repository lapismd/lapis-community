export type CommunityRoomKind = "channel" | "forum" | "direct";
export type CommunityPresence = "online" | "away" | "offline";
export type CommunityMainView = "channel" | "forum-index" | "forum-thread";
export type CommunitySidePanel = "thread" | "details" | "none";

export interface CommunityModel {
  id: string;
  name: string;
  initials: string;
  description?: string;
  unreadCount?: number;
}

export interface CommunityRoomModel {
  id: string;
  name: string;
  kind: CommunityRoomKind;
  description?: string;
  unreadCount?: number;
  mentionCount?: number;
  memberCount?: number;
  private?: boolean;
}

export interface CommunityWorkspaceNavigationSectionModel {
  id: string;
  label: string;
  rooms: CommunityRoomModel[];
}

export interface CommunityMemberModel {
  id: string;
  name: string;
  handle: string;
  initials: string;
  avatarUrl?: string;
  presence?: CommunityPresence;
  role?: string;
}

export interface CommunityReactionModel {
  emoji: string;
  count: number;
  selected?: boolean;
  label?: string;
}

export interface CommunityMessageModel {
  id: string;
  authorId: string;
  content: string;
  timestamp: string;
  createdAt?: string;
  edited?: boolean;
  parentMessageId?: string;
  replyCount?: number;
  replyLabel?: string;
  replyParticipantIds?: string[];
  reactions?: CommunityReactionModel[];
}

export interface CommunityTopicModel {
  id: string;
  title: string;
  excerpt: string;
  authorId: string;
  tags?: string[];
  replyCount: number;
  participantIds: string[];
  lastActivityLabel: string;
  pinned?: boolean;
  solved?: boolean;
}

export interface CommunityThreadModel {
  rootMessageId: string;
  messages: CommunityMessageModel[];
}

export interface CommunityDetailsModel {
  description: string;
  guidelines?: string[];
  memberIds: string[];
  moderatorIds?: string[];
}

export interface CommunityWorkspaceModel {
  communities: CommunityModel[];
  activeCommunityId: string;
  navigationSections: CommunityWorkspaceNavigationSectionModel[];
  activeRoomId: string;
  view: CommunityMainView;
  messages: CommunityMessageModel[];
  topics: CommunityTopicModel[];
  members: CommunityMemberModel[];
  currentMemberId?: string;
  thread?: CommunityThreadModel;
  details?: CommunityDetailsModel;
  sidePanel?: CommunitySidePanel;
}

export interface CommunityWorkspaceHandlers {
  onSelectCommunity?: (communityId: string) => void;
  onSelectRoom?: (roomId: string) => void;
  onOpenTopic?: (topicId: string) => void;
  onOpenThread?: (messageId: string) => void;
  onCloseSidePanel?: () => void;
  onOpenDetails?: () => void;
  onSendMessage?: (roomId: string, content: string) => void;
  onSendReply?: (rootMessageId: string, content: string) => void;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  onAddReaction?: (messageId: string, emoji: string) => void;
  onCopyMessageLink?: (messageId: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onSearch?: (query: string) => void;
}

export function findCommunityRoom(
  model: CommunityWorkspaceModel,
): CommunityRoomModel | undefined {
  return model.navigationSections
    .flatMap((section) => section.rooms)
    .find((room) => room.id === model.activeRoomId);
}

export function memberById(
  members: readonly CommunityMemberModel[],
  memberId: string,
): CommunityMemberModel {
  return (
    members.find((member) => member.id === memberId) ?? {
      id: memberId,
      name: "Unknown member",
      handle: memberId.slice(0, 12),
      initials: "?",
      presence: "offline",
    }
  );
}
