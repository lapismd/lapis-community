import {
  memberById,
  type CommunityMemberModel,
  type CommunityMessageModel,
} from "../../community/workspace-model.js";

export function messageActivityContent(
  activity: CommunityMessageModel["activity"],
  members: readonly CommunityMemberModel[],
): string {
  if (!activity) return "";
  const target =
    activity.targetMemberId === undefined
      ? undefined
      : memberById(members, activity.targetMemberId);
  const reference = target === undefined ? "a member" : `@${target.name}`;
  switch (activity.type) {
    case "channel-created":
      return "created this channel";
    case "member-added":
      return `added ${reference} to this channel`;
    case "member-removed":
      return `removed ${reference} from this channel`;
    case "member-joined":
      return "joined this channel";
    case "member-left":
      return "left this channel";
  }
}
