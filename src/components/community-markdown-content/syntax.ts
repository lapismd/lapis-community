import {
  defineMiraExtension,
  type MiraExtension,
} from "@lapismd/mira/extensions";

import type { CommunityCustomEmoji } from "../../community/index.js";
import {
  contentMentionLabel,
  contentMentionMatches,
} from "../../community/content-mentions.js";
import type {
  CommunityMemberModel,
  CommunityRoomModel,
} from "../community-workspace/model.js";
import CommunityChannelReference from "./CommunityChannelReference.svelte";
import CommunityEmojiReference from "./CommunityEmojiReference.svelte";
import CommunityMemberReference from "./CommunityMemberReference.svelte";
import CommunitySpoiler from "./CommunitySpoiler.svelte";
import { isSafeCommunityEmojiUrl } from "../community-chat-composer/model.js";
import {
  applyCommunityMarkdownSyntax,
  type CommunityMarkdownHastNode,
} from "./syntax-hast.js";

export type CommunityMarkdownSegment =
  | { kind: "text"; value: string }
  | { kind: "member"; value: string; memberId: string }
  | { kind: "room"; value: string; roomId: string }
  | { kind: "emoji"; value: string; shortcode: string; url: string }
  | { kind: "spoiler"; value: string };

export interface CommunityMarkdownSyntaxOptions {
  members(): readonly CommunityMemberModel[];
  rooms(): readonly CommunityRoomModel[];
  emojis(): readonly CommunityCustomEmoji[];
  mentionPubkeys(): readonly string[];
}

export function createCommunityMarkdownExtension(
  options: CommunityMarkdownSyntaxOptions,
): MiraExtension {
  const rehypeCommunitySyntax = () => (tree: CommunityMarkdownHastNode) => {
    applyCommunityMarkdownSyntax(tree, options, tokenizeCommunityMarkdownText);
  };

  return defineMiraExtension({
    name: "community-message-markdown",
    components: {
      communitychannel: CommunityChannelReference,
      communityemoji: CommunityEmojiReference,
      communitymember: CommunityMemberReference,
      communityspoiler: CommunitySpoiler,
    },
    rehypePlugins: [rehypeCommunitySyntax],
  });
}

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
  const references = [
    ...memberTokens,
    ...publishedMentions,
    ...roomTokens,
    ...emojiTokens,
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
      if (nextReference.reference.kind === "member") {
        const source = value.slice(
          nextReference.index,
          nextReference.index + nextReference.reference.token.length,
        );
        segments.push({
          kind: "member",
          value: contentMentionLabel(
            nextReference.reference.id,
            source,
            members,
          ),
          memberId: nextReference.reference.id,
        });
      } else if (nextReference.reference.kind === "room") {
        segments.push({
          kind: "room",
          value: value.slice(
            nextReference.index,
            nextReference.index + nextReference.reference.token.length,
          ),
          roomId: nextReference.reference.id,
        });
      } else {
        segments.push({
          kind: "emoji",
          value: nextReference.reference.token,
          shortcode: nextReference.reference.id,
          url: nextReference.reference.url,
        });
      }
      cursor = nextReference.index + nextReference.reference.token.length;
      continue;
    }
    pushText(segments, value.slice(cursor));
    break;
  }

  return segments;
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
  | { kind: "emoji"; token: string; id: string; url: string };

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
  if (token.startsWith(":")) return true;
  const before = value[index - 1] ?? "";
  const after = value[index + token.length] ?? "";
  return !/[\p{L}\p{N}_]/u.test(before) && !/[\p{L}\p{N}_-]/u.test(after);
}

function pushText(segments: CommunityMarkdownSegment[], value: string): void {
  if (value !== "") segments.push({ kind: "text", value });
}
