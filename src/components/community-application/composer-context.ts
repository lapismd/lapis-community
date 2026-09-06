import { getContext, setContext } from "svelte";

import type { CommunityCustomEmoji } from "../../community/contracts.js";
import type {
  CommunityMemberModel,
  CommunityRoomModel,
} from "../community-workspace/model.js";

export interface CommunityApplicationComposerContext {
  members(): readonly CommunityMemberModel[];
  rooms(): readonly CommunityRoomModel[];
  emojis(): readonly CommunityCustomEmoji[];
}

const composerContextKey = Symbol("community-application-composer");

export function provideCommunityApplicationComposer(
  context: CommunityApplicationComposerContext,
): void {
  setContext(composerContextKey, context);
}

export function useCommunityApplicationComposer():
  | CommunityApplicationComposerContext
  | undefined {
  return getContext<CommunityApplicationComposerContext | undefined>(
    composerContextKey,
  );
}
