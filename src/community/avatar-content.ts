export type CommunityMemberAvatarContent =
  | { kind: "image"; src: string }
  | { kind: "emoji"; emoji: string }
  | { kind: "initials"; initials: string };

export function isCommunityAvatarImage(value: string): boolean {
  return /^(https?:\/\/|data:image\/|blob:)/i.test(value.trim());
}

export function isCommunityAvatarEmoji(value: string): boolean {
  const emoji = value.trim();
  if (!emoji || isCommunityAvatarImage(emoji)) return false;
  if (/^(https?:|data:|blob:|\/\/)/i.test(emoji)) return false;
  const graphemes = graphemeCount(emoji);
  return graphemes > 0 && graphemes <= 4 && !/^[\w./-]+$/.test(emoji);
}

export function communityStoredAvatar(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return;
  if (isCommunityAvatarImage(trimmed) || isCommunityAvatarEmoji(trimmed)) {
    return trimmed;
  }
}

export function communityMemberAvatarContent(member: {
  avatarUrl?: string;
  initials: string;
}): CommunityMemberAvatarContent {
  const value = member.avatarUrl?.trim() ?? "";
  if (isCommunityAvatarImage(value)) return { kind: "image", src: value };
  if (isCommunityAvatarEmoji(value)) return { kind: "emoji", emoji: value };
  return { kind: "initials", initials: member.initials };
}

function graphemeCount(value: string): number {
  try {
    return [
      ...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
        value,
      ),
    ].length;
  } catch {
    return [...value].length;
  }
}
