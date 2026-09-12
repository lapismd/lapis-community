import { getContext, setContext } from "svelte";

import type {
  CommunityMemberModel,
  CommunityPresence,
} from "../community-workspace/model.js";

export type CommunityMemberPresenceResolver = (
  member: CommunityMemberModel,
) => CommunityPresence | undefined;

const communityMemberPresenceContextKey = Symbol("community-member-presence");

export function provideCommunityMemberPresence(
  resolve: CommunityMemberPresenceResolver,
): void {
  setContext(communityMemberPresenceContextKey, resolve);
}

export function useCommunityMemberPresence():
  | CommunityMemberPresenceResolver
  | undefined {
  return getContext(communityMemberPresenceContextKey);
}
