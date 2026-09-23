import { getContext, setContext } from "svelte";

const key = Symbol.for("lapismd.community-composer-draft-scope");

export interface CommunityComposerDraftScope {
  communityId: string;
  roomId: string;
  viewer?: string | undefined;
}

export function provideComposerDraftScope(
  read: () => CommunityComposerDraftScope | undefined,
): void {
  setContext(key, read);
}

export function composerDraftScopeReader():
  | (() => CommunityComposerDraftScope | undefined)
  | undefined {
  return getContext(key);
}
