import type { CommunityMemberModel } from "../community-workspace/model.js";

export function communityProjectsMemberForPubkey(
  members: readonly CommunityMemberModel[],
  pubkey: string,
): CommunityMemberModel {
  const known = members.find((member) => member.id === pubkey);
  if (known) return known;
  const shortened = pubkey.slice(0, 12);
  return {
    id: pubkey,
    name: shortened,
    handle: shortened,
    initials: shortened.slice(0, 2).toUpperCase(),
  };
}
