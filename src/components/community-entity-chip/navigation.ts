import { getContext, setContext } from "svelte";

import type { CommunityEntityLink } from "../../community/community-links.js";

export type CommunityEntityNavigation = {
  open(link: CommunityEntityLink): void;
  label(link: CommunityEntityLink): string;
};

export const communityEntityNavigationKey = Symbol(
  "community-entity-navigation",
);

export function provideCommunityEntityNavigation(
  navigation: CommunityEntityNavigation,
): void {
  setContext(communityEntityNavigationKey, navigation);
}

export function useCommunityEntityNavigation():
  | CommunityEntityNavigation
  | undefined {
  return getContext<CommunityEntityNavigation | undefined>(
    communityEntityNavigationKey,
  );
}
