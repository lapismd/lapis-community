import { getContext, setContext } from "svelte";

const key = Symbol.for("lapismd.community-review-composer-draft-scope");

export interface CommunityReviewComposerDraftScope {
  pullRequestId: string;
  viewer?: string | undefined;
  communityId?: string | undefined;
}

export function provideReviewComposerDraftScope(
  read: () => CommunityReviewComposerDraftScope | undefined,
): void {
  setContext(key, read);
}

export function reviewComposerDraftScopeReader():
  | (() => CommunityReviewComposerDraftScope | undefined)
  | undefined {
  return getContext(key);
}
