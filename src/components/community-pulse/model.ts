import type { ComposerStatus } from "@lapismd/design-core/ai/chat";

import type {
  CommunityCustomEmoji,
  CommunityOperationState,
  CommunityPulseModel,
  CommunityPulseTab,
} from "../../community/index.js";
import type {
  CommunityComposerDraftStore,
  CommunityComposerSubmission,
  CommunityMessageMediaAdapter,
} from "../community-chat-composer/model.js";
import type {
  CommunityMemberModel,
  CommunityRoomModel,
} from "../community-workspace/model.js";

export interface CommunityPulseHandlers {
  onSelectTab?: (tab: CommunityPulseTab) => void | Promise<void>;
  onPublish?: (
    submission: CommunityComposerSubmission,
    replyToEventId?: string,
  ) => void | Promise<void>;
  onToggleLike?: (eventId: string) => void | Promise<void>;
  onShare?: (eventId: string) => void | Promise<void>;
  onOpenProfile?: (member: CommunityMemberModel) => void;
  onMessageMember?: (member: CommunityMemberModel) => void | Promise<void>;
  onRetry?: () => void | Promise<void>;
  onDismissError?: () => void;
}

export interface CommunityPulseProps extends CommunityPulseHandlers {
  model: CommunityPulseModel;
  currentMember?: CommunityMemberModel;
  rooms?: readonly CommunityRoomModel[];
  communityEmojis?: readonly CommunityCustomEmoji[];
  draftStore?: CommunityComposerDraftStore;
  mediaAdapter?: CommunityMessageMediaAdapter;
  publishOperation?: CommunityOperationState;
  composerStatus?: ComposerStatus;
  class?: string;
}
