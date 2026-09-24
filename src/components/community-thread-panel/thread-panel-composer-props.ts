import type { ComposerStatus } from "@lapismd/design-core/ai/chat";
import type {
  CommunityCustomEmoji,
  CommunityReplyTarget,
} from "../../community/index.js";
import type { CommunityComposerAgentModel } from "../community-chat-composer/composer-agent-model.js";
import type { CommunityAgentActivityContext } from "../../community/agent-contracts.js";
import type {
  CommunityMemberModel,
  CommunityMessageModel,
  CommunityRoomModel,
} from "../community-workspace/model.js";
export type ThreadPanelComposerProps = {
  value?: string;
  members: readonly CommunityMemberModel[];
  rooms: readonly CommunityRoomModel[];
  agents?: readonly CommunityComposerAgentModel[];
  currentMemberId?: string | undefined;
  rootMessageId: string;
  rootMessage?: CommunityMessageModel | undefined;
  rootAuthorName?: string | undefined;
  editingMessageId?: string | undefined;
  replyTarget?: CommunityReplyTarget | undefined;
  communityEmojis?: readonly CommunityCustomEmoji[];
  activityContext?: CommunityAgentActivityContext | undefined;
  disabled?: boolean;
  disabledReason?: string;
  composerStatus?: ComposerStatus | undefined;
  onSendReply?:
    | ((
        rootMessageId: string,
        content: string,
        mentionPubkeys?: readonly string[],
      ) => void | Promise<void>)
    | undefined;
  onSaveMessageEdit?:
    | ((messageId: string, content: string) => void | Promise<void>)
    | undefined;
  onCancelReply?: (() => void) | undefined;
  onOpenProfile?: ((member: CommunityMemberModel) => void) | undefined;
  onMessageMember?:
    | ((member: CommunityMemberModel) => void | Promise<void>)
    | undefined;
  onWaveMember?:
    | ((member: CommunityMemberModel) => void | Promise<void>)
    | undefined;
  onRetryComposerStatus?: (() => void | Promise<void>) | undefined;
  onDismissComposerStatus?: (() => void) | undefined;
};
