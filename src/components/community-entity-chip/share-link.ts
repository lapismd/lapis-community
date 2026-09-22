import { getContext, setContext } from "svelte";

export type CommunityShareLink = {
  href(): string | undefined;
  copy(value: string, success: string): void;
};

const key = Symbol("community-share-link");

export function provideCommunityShareLink(share: CommunityShareLink): void {
  setContext(key, share);
}

export function useCommunityShareLink(): CommunityShareLink | undefined {
  return getContext<CommunityShareLink | undefined>(key);
}
