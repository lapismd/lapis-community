import type {
  CommunityMemberModel,
  CommunityMessageModel,
  CommunityRoomModel,
} from "../community-workspace/model.js";

export interface CommunityInboxItemModel {
  conversation?: import("../../community/conversations.js").CommunityConversationReference;
  scopeId?: string;
  roomId?: string;
  rootEventId?: string;
  categories?: readonly Exclude<CommunityInboxFilter, "All">[];
  latestEventId?: string;
  latestCreatedAt?: number;
  id: string;
  authorId: string;
  context: string;
  timestamp: string;
  excerpt: string;
  unread?: boolean;
}

export interface CommunityInboxModel {
  filter?: CommunityInboxFilter;
  unreadOnly?: boolean;
  unreadCount?: number;
  /** False means cached history only establishes a lower bound. */
  unreadComplete?: boolean;
  items: readonly CommunityInboxItemModel[];
  activeItemId: string;
  /** Retains the selected conversation when filters or paging hide its list row. */
  selectedItem?: CommunityInboxItemModel;
  threadTitle: string;
  room: CommunityRoomModel;
  messages: CommunityMessageModel[];
  members: CommunityMemberModel[];
  participantCount?: number;
}

export type CommunityInboxFilter =
  | "All"
  | "Direct messages"
  | "Mentions"
  | "Threads";
