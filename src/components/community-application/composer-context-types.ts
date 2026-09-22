import type { CommunityCustomEmoji } from "../../community/contracts.js";
import type {
  CommunityMemberModel,
  CommunityRoomModel,
} from "../community-workspace/model.js";

export interface CommunityApplicationComposerContext {
  members(): readonly CommunityMemberModel[];
  rooms(): readonly CommunityRoomModel[];
  emojis(): readonly CommunityCustomEmoji[];
  onOpenMember(): (member: CommunityMemberModel) => void;
  onMessageMember(): (member: CommunityMemberModel) => void | Promise<void>;
  onWaveMember():
    | ((member: CommunityMemberModel) => void | Promise<void>)
    | undefined;
}
