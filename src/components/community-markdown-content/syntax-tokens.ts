import type { CommunityCustomEmoji } from "../../community/index.js";
import {
  contentMentionLabel,
  contentMentionMatches,
} from "../../community/content-mentions.js";
import { communityMarkdownEntityMatches } from "./syntax-entity.js";
import type {
  CommunityMemberModel,
  CommunityRoomModel,
} from "../community-workspace/model.js";
import { isSafeCommunityEmojiUrl } from "../community-chat-composer/model.js";

export type CommunityMarkdownSegment =
  | { kind: "text"; value: string }
  | { kind: "member"; value: string; memberId: string }
  | { kind: "room"; value: string; roomId: string }
  | { kind: "entity"; href: string; value: string }
  | { kind: "emoji"; value: string; shortcode: string; url: string }
  | { kind: "spoiler"; value: string };

export function tokenizeCommunityMarkdownText(
  value: string,
  members: readonly CommunityMemberModel[],
  rooms: readonly CommunityRoomModel[],
  emojis: readonly CommunityCustomEmoji[],
  mentionPubkeys: readonly string[],
): CommunityMarkdownSegment[] {
  const mentionSet = new Set(mentionPubkeys);
  const memberTokens = uniqueTokenEntries(
    members.filter((member) => mentionSet.has(member.id)),
    (member) => member.name,
  ).map(({ value: member, token }) => ({
    kind: "member" as const,
    token: `@${token}`,
    id: member.id,
  }));
  const roomTokens = uniqueTokenEntries(
    rooms.filter((room) => room.kind !== "direct" && room.archived !== true),
    (room) => room.name,
  ).map(({ value: room, token }) => ({
    kind: "room" as const,
    token: `#${token}`,
    id: room.id,
  }));
  const emojiTokens = uniqueTokenEntries(
    emojis.filter((emoji) => isSafeCommunityEmojiUrl(emoji.url)),
    (emoji) => emoji.shortcode,
  ).map(({ value: emoji, token }) => ({
    kind: "emoji" as const,
    token: `:${token}:`,
    id: emoji.shortcode,
    url: emoji.url,
  }));
  const publishedMentions = contentMentionMatches(value).map((mention) => ({
    kind: "member" as const,
    token: mention.value,
    id: mention.pubkey,
  }));
  const entityTokens = communityMarkdownEntityMatches(value).map((match) => ({
    kind: "entity" as const,
    token: match.value,
    href: match.href,
  }));
  const references = [
    ...memberTokens,
    ...publishedMentions,
    ...roomTokens,
    ...emojiTokens,
    ...entityTokens,
  ].sort((left, right) => right.token.length - left.token.length);
  const segments: CommunityMarkdownSegment[] = [];
  let cursor = 0;

  while (cursor < value.length) {
    const spoilerStart = value.indexOf("||", cursor);
    const spoilerEnd =
      spoilerStart < 0 ? -1 : value.indexOf("||", spoilerStart + 2);
    const nextReference = earliestReference(value, cursor, references);
    const useSpoiler =
      spoilerStart >= cursor &&
      spoilerEnd > spoilerStart + 2 &&
      (nextReference === undefined || spoilerStart <= nextReference.index);

    if (useSpoiler) {
      pushText(segments, value.slice(cursor, spoilerStart));
      segments.push({
        kind: "spoiler",
        value: value.slice(spoilerStart + 2, spoilerEnd),
      });
      cursor = spoilerEnd + 2;
      continue;
    }
    if (nextReference !== undefined) {
      pushText(segments, value.slice(cursor, nextReference.index));
      segments.push(segmentForReference(nextReference.reference, members));
      cursor = nextReference.index + nextReference.reference.token.length;
      continue;
    }
    pushText(segments, value.slice(cursor));
    break;
  }

  return segments;
}

function segmentForReference(
  reference: ReferenceToken,
  members: readonly CommunityMemberModel[],
): CommunityMarkdownSegment {
  if (reference.kind === "member") {
    return {
      kind: "member",
      value: contentMentionLabel(reference.id, reference.token, members),
      memberId: reference.id,
    };
  }
  if (reference.kind === "room") {
    return { kind: "room", value: reference.token, roomId: reference.id };
  }
  if (reference.kind === "entity") {
    return { kind: "entity", href: reference.href, value: reference.token };
  }
  return {
    kind: "emoji",
    value: reference.token,
    shortcode: reference.id,
    url: reference.url,
  };
}

function uniqueTokenEntries<T>(
  values: readonly T[],
  label: (value: T) => string,
): Array<{ value: T; token: string }> {
  const byToken = new Map<string, Array<{ value: T; token: string }>>();
  for (const value of values) {
    const token = label(value).trim();
    if (token === "") continue;
    const normalized = token.toLocaleLowerCase();
    byToken.set(normalized, [
      ...(byToken.get(normalized) ?? []),
      { value, token },
    ]);
  }
  return [...byToken.values()]
    .filter((entries) => entries.length === 1)
    .map((entries) => entries[0]!);
}

type ReferenceToken =
  | { kind: "member"; token: string; id: string }
  | { kind: "room"; token: string; id: string }
  | { kind: "emoji"; token: string; id: string; url: string }
  | { kind: "entity"; token: string; href: string };

function earliestReference(
  value: string,
  cursor: number,
  references: readonly ReferenceToken[],
): { index: number; reference: ReferenceToken } | undefined {
  let result: { index: number; reference: ReferenceToken } | undefined;
  for (const reference of references) {
    let index = value
      .toLocaleLowerCase()
      .indexOf(reference.token.toLocaleLowerCase(), cursor);
    while (index >= 0 && !hasTokenBoundary(value, index, reference.token)) {
      index = value
        .toLocaleLowerCase()
        .indexOf(reference.token.toLocaleLowerCase(), index + 1);
    }
    if (
      index >= 0 &&
      (result === undefined ||
        index < result.index ||
        (index === result.index &&
          reference.token.length > result.reference.token.length))
    ) {
      result = { index, reference };
    }
  }
  return result;
}

function hasTokenBoundary(
  value: string,
  index: number,
  token: string,
): boolean {
  if (
    token.startsWith(":") ||
    token.includes("://") ||
    token.startsWith("#/")
  ) {
    return true;
  }
  const before = value[index - 1] ?? "";
  const after = value[index + token.length] ?? "";
  return !/[\p{L}\p{N}_]/u.test(before) && !/[\p{L}\p{N}_-]/u.test(after);
}

function pushText(segments: CommunityMarkdownSegment[], value: string): void {
  if (value !== "") segments.push({ kind: "text", value });
}
