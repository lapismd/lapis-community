import { getContext, setContext } from "svelte";

import { mergeComposerSlashCatalog } from "../community-chat-composer/composer-slash-catalog.js";
import { provideCommunityComposerSlashCatalog } from "../community-chat-composer/composer-slash-context.js";
import { readComposerSlashSession } from "../community-chat-composer/composer-slash-session.js";
import type { CommunityApplicationComposerContext } from "./composer-context-types.js";

export type { CommunityApplicationComposerContext };

const composerContextKey = Symbol("community-application-composer");

export function provideCommunityApplicationComposer(
  context: CommunityApplicationComposerContext,
): void {
  setContext(composerContextKey, context);
  provideCommunityComposerSlashCatalog(() =>
    mergeComposerSlashCatalog(context.rooms(), readComposerSlashSession()),
  );
}

export function useCommunityApplicationComposer():
  | CommunityApplicationComposerContext
  | undefined {
  return getContext<CommunityApplicationComposerContext | undefined>(
    composerContextKey,
  );
}
