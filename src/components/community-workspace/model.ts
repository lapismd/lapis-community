export type CommunityRoomKind = "channel" | "forum" | "direct";
export type CommunityPresence = "online" | "away" | "offline";
export type CommunityMainView = "channel" | "forum-index" | "forum-thread";
export type CommunitySidePanel = "thread" | "details" | "none";
export type CommunityActionAvailabilityState =
  | "enabled"
  | "requires-authentication"
  | "denied"
  | "unsupported";

export interface CommunityActionAvailability {
  state: CommunityActionAvailabilityState;
  reason?: string;
  requirement?: "authentication" | "membership" | "writer";
}

export interface CommunityRoomActionPermissions {
  publish: CommunityActionAvailability;
  react?: CommunityActionAvailability;
  join: CommunityActionAvailability;
  leave: CommunityActionAvailability;
  update: CommunityActionAvailability;
  delete: CommunityActionAvailability;
  manageMembers: CommunityActionAvailability;
}

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
  participantIds?: readonly string[];
  description?: string;
  unreadCount?: number;
  mentionCount?: number;
  memberCount?: number;
  private?: boolean;
  archived?: boolean;
  membership?: "joined" | "not-joined" | "unknown";
  memberListCompleteness?: "complete" | "partial" | "unavailable";
  lifecycle?: "ongoing" | "temporary";
  expiresAt?: string;
  lastActivityAt?: string;
  permissions?: CommunityRoomActionPermissions;
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
  status?: string;
  role?: string;
}

export interface CommunityReactionModel {
  emoji: string;
  count: number;
  selected?: boolean;
  label?: string;
  customEmojiUrl?: string;
}

export interface CommunityEmojiReference {
  shortcode: string;
  url: string;
}

export interface CommunityMessageModel {
  id: string;
  authorId: string;
  content: string;
  mentionPubkeys?: readonly string[];
  timestamp: string;
  createdAt?: string;
  edited?: boolean;
  parentMessageId?: string;
  replyCount?: number;
  replyLabel?: string;
  replyParticipantIds?: string[];
  lastReplyAt?: string;
  reactions?: CommunityReactionModel[];
}

export interface CommunityTopicModel {
  id: string;
  title: string;
  excerpt: string;
  authorId: string;
  tags?: string[];
  replyCount: number;
  replyCountAvailable?: boolean;
  replyCountApproximate?: boolean;
  participantIds: string[];
  lastActivityLabel: string;
  unread?: boolean;
  isNew?: boolean;
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
  onReply?: (messageId: string) => void;
  onOpenThread?: (messageId: string) => void;
  onCloseSidePanel?: () => void;
  onOpenDetails?: () => void;
  onSendMessage?: (roomId: string, content: string) => void | Promise<void>;
  onSendReply?: (
    rootMessageId: string,
    content: string,
  ) => void | Promise<void>;
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
  onCopyMessageLink?: (messageId: string) => void;
  onCopyMessage?: (messageId: string) => void;
  onEditMessage?: (messageId: string) => void | Promise<void>;
  onDeleteMessage?: (messageId: string) => void | Promise<void>;
  onOpenProfile?: (member: CommunityMemberModel) => void;
  onMessageMember?: (member: CommunityMemberModel) => void | Promise<void>;
  onViewMemberActivity?: (member: CommunityMemberModel) => void | Promise<void>;
  onBrowseRooms?: (kind?: "channel" | "forum") => void;
  onJoinRoom?: (roomId: string) => void | Promise<void>;
  onCreateRoom?: (kind: "channel" | "forum") => void;
  onCreateAgent?: (roomId: string) => void | Promise<void>;
  onCreateTopic?: (
    roomId: string,
    draft: import("../../community/index.js").CommunityTopicDraft,
  ) => void | Promise<void>;
  onTopicAction?: (
    topicId: string,
    action: "copy-link" | "mark-read" | "star" | "mute" | "delete",
  ) => void | Promise<void>;
  onClearReplyTarget?: () => void;
  onSearch?: (query: string) => void;
}

export function findCommunityRoom(
  model: CommunityWorkspaceModel,
): CommunityRoomModel | undefined {
  return model.navigationSections
    .flatMap((section) => section.rooms)
    .find((room) => room.id === model.activeRoomId);
}

export function rootCommunityMessageId(
  messages: readonly CommunityMessageModel[],
  messageId: string,
): string {
  const messagesById = new Map(
    messages.map((message) => [message.id, message]),
  );
  const visited = new Set<string>();
  let currentId = messageId;
  while (!visited.has(currentId)) {
    visited.add(currentId);
    const parentId = messagesById.get(currentId)?.parentMessageId;
    if (parentId === undefined || !messagesById.has(parentId)) return currentId;
    currentId = parentId;
  }
  return messageId;
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
