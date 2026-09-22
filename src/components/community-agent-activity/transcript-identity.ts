import type { CommunityMemberModel } from "../community-workspace/model.js";

/** Resolve a transcript author from known members, or a generic owner fallback. */
export function transcriptOlderPage(
  onLoadOlder?: () => void | Promise<void>,
  hasOlder = false,
  loading = false,
) {
  return onLoadOlder
    ? {
        scrollToTopAction: async () => {
          await onLoadOlder();
        },
        hasOlder,
        loading,
      }
    : {};
}

export function transcriptAuthor(
  pubkey: string,
  members: readonly CommunityMemberModel[],
): CommunityMemberModel {
  return (
    members.find((member) => member.id === pubkey) ?? {
      id: pubkey,
      name: "You",
      handle: pubkey,
      initials: "YO",
    }
  );
}
