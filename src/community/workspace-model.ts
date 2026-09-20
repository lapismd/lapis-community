import type { NostrEvent } from "../protocol/index.js";
import type { CommunityConversationReference } from "./conversations.js";
import type { CommunityWorkspaceSendHandlers } from "./send-contracts.js";

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
  requirement?: "authentication" | "membership" | "writer" | "maintainer";
}

export interface CommunityRoomActionPermissions {
  publish: CommunityActionAvailability;
  react?: CommunityActionAvailability;
  join: CommunityActionAvailability;
  leave: CommunityActionAvailability;
  update: CommunityActionAvailability;
  delete: CommunityActionAvailability;
  manageMembers: CommunityActionAvailability;
  maintain?: CommunityActionAvailability;
}

export interface CommunityModel {
  id: string;
  name: string;
  initials: string;
  description?: string;
  unreadCount?: number;
  /** False means cached history only establishes a lower bound. */
  unreadComplete?: boolean;
}

export interface CommunityRoomModel {
  conversation?: CommunityConversationReference;
  id: string;
  /** Canonical NIP-29 group id backing the room, when relay-backed. */
  groupId?: string;
  name: string;
  kind: CommunityRoomKind;
  /** Presentation hint derived from the verified project catalog; never grants access. */
  isProjectChannel?: boolean;
  participantIds?: readonly string[];
  description?: string;
  unreadCount?: number;
  /** False means cached history only establishes a lower bound. */
  unreadComplete?: boolean;
  mentionCount?: number;
  /** Latest incoming content event represented by this room projection. */
  latestUnreadEventId?: string;
  memberCount?: number;
  /** Number of visible room messages in the current relay projection. */
  messageCount?: number;
  private?: boolean;
  postingPolicy?: "standard" | "writers";
  roleDefinitions?: readonly CommunityRoleDefinition[];
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
  roles?: readonly string[];
  administrator?: boolean;
  /** Present when this identity is a known agent. Absent means a person. */
  kind?: "agent";
}

export interface CommunityRoleDefinition {
  id: string;
  label: string;
  description?: string;
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

export interface CommunityMessageActivity {
  type:
    | "channel-created"
    | "member-added"
    | "member-removed"
    | "member-joined"
    | "member-left";
  targetMemberId?: string;
}

export interface CommunityMessageModel {
  id: string;
  authorId: string;
  content: string;
  /** An accepted NIP-29 channel lifecycle command rendered in the timeline. */
  activity?: CommunityMessageActivity;
  /** The verified public relay event backing this message, when available. */
  sourceEvent?: NostrEvent;
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

export interface CommunityWorkspaceHandlers
  extends CommunityWorkspaceSendHandlers {
  onSelectCommunity?: (communityId: string) => void;
  onSelectRoom?: (roomId: string) => void;
  onReadRoom?: (
    roomId: string,
    through: { eventId: string; threadId?: string; timeline?: boolean },
  ) => void;
  onOpenTopic?: (topicId: string) => void;
  onReply?: (messageId: string) => void;
  onOpenThread?: (messageId: string) => void;
  onCloseSidePanel?: () => void;
  onOpenDetails?: () => void;
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
  onCopyEvent?: (messageId: string) => void;
  onEditMessage?: (messageId: string) => void | Promise<void>;
  onSaveMessageEdit?: (
    messageId: string,
    content: string,
  ) => void | Promise<void>;
  onDeleteMessage?: (messageId: string) => void | Promise<void>;
  onReportMessage?: (
    messageId: string,
    report: import("./contracts.js").CommunityMessageReport,
  ) => void | Promise<void>;
  onOpenProfile?: (member: CommunityMemberModel) => void;
  onMessageMember?: (member: CommunityMemberModel) => void | Promise<void>;
  onWaveMember?: (member: CommunityMemberModel) => void | Promise<void>;
  onViewMemberActivity?: (member: CommunityMemberModel) => void | Promise<void>;
  onBrowseRooms?: (kind?: "channel" | "forum") => void;
  onJoinRoom?: (roomId: string) => void | Promise<void>;
  onCreateRoom?: (kind: "channel" | "forum") => void;
  onCreateAgent?: (roomId: string) => void | Promise<void>;
  onCreateTopic?: (
    roomId: string,
    draft: import("./contracts.js").CommunityTopicDraft,
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
