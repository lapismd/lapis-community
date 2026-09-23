export const COMMUNITY_COMPOSER_DRAFT_SURFACES = [
  "forum-topic",
  "thread",
  "pulse",
  "task",
  "pull-request",
  "pull-request-inline",
] as const;

export type CommunityComposerDraftSurface =
  (typeof COMMUNITY_COMPOSER_DRAFT_SURFACES)[number];

export function communityComposerDraftKey(input: {
  viewer?: string | undefined;
  communityId?: string | undefined;
  surface: CommunityComposerDraftSurface;
  target: string;
}): string {
  return JSON.stringify([
    "community-composer",
    input.viewer ?? "",
    input.communityId ?? "",
    input.surface,
    input.target,
  ]);
}
