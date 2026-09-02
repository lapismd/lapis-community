import type {
  CommunityMemberModel,
  CommunityMessageModel,
  CommunityRoomModel,
} from "../community-workspace/model.js";

export interface CommunityInboxItemModel {
  id: string;
  authorId: string;
  context: string;
  timestamp: string;
  excerpt: string;
  unread?: boolean;
}

export interface CommunityInboxModel {
  items: readonly CommunityInboxItemModel[];
  activeItemId: string;
  threadTitle: string;
  room: CommunityRoomModel;
  messages: CommunityMessageModel[];
  members: CommunityMemberModel[];
  participantCount?: number;
}
