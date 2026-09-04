import {
  defineMiraExtension,
  type MiraExtension,
} from "@lapismd/mira/extensions";

import type { CommunityCustomEmoji } from "../../community/index.js";
import type {
  CommunityMemberModel,
  CommunityRoomModel,
} from "../community-workspace/model.js";
import CommunityChannelReference from "./CommunityChannelReference.svelte";
import CommunityEmojiReference from "./CommunityEmojiReference.svelte";
import CommunityMemberReference from "./CommunityMemberReference.svelte";
import CommunitySpoiler from "./CommunitySpoiler.svelte";

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

type HastNode = {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

export function createCommunityMarkdownExtension(
  options: CommunityMarkdownSyntaxOptions,
): MiraExtension {
  const rehypeCommunitySyntax = () => (tree: HastNode) => {
    transformChildren(tree, options, []);
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
    emojis,
    (emoji) => emoji.shortcode,
  ).map(({ value: emoji, token }) => ({
    kind: "emoji" as const,
    token: `:${token}:`,
    id: emoji.shortcode,
    url: emoji.url,
  }));
  const references = [...memberTokens, ...roomTokens, ...emojiTokens].sort(
    (left, right) => right.token.length - left.token.length,
  );
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
        segments.push({
          kind: "member",
          value: value.slice(
            nextReference.index,
            nextReference.index + nextReference.reference.token.length,
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

function transformChildren(
  node: HastNode,
  options: CommunityMarkdownSyntaxOptions,
  ancestors: string[],
): void {
  if (!Array.isArray(node.children)) return;
  const currentAncestors =
    node.tagName === undefined ? ancestors : [...ancestors, node.tagName];
  const skipText = currentAncestors.some((tag) =>
    ["a", "code", "pre", "script", "style"].includes(tag),
  );

  const nextChildren: HastNode[] = [];
  for (const child of node.children) {
    if (child.type === "text" && typeof child.value === "string" && !skipText) {
      nextChildren.push(
        ...tokenizeCommunityMarkdownText(
          child.value,
          options.members(),
          options.rooms(),
          options.emojis(),
          options.mentionPubkeys(),
        ).map(segmentToHast),
      );
      continue;
    }
    transformChildren(child, options, currentAncestors);
    nextChildren.push(child);
  }
  node.children = nextChildren;
}

function segmentToHast(segment: CommunityMarkdownSegment): HastNode {
  if (segment.kind === "text") return { type: "text", value: segment.value };
  if (segment.kind === "member") {
    return {
      type: "element",
      tagName: "communitymember",
      properties: { memberId: segment.memberId, label: segment.value },
      children: [],
    };
  }
  if (segment.kind === "room") {
    return {
      type: "element",
      tagName: "communitychannel",
      properties: { roomId: segment.roomId, label: segment.value },
      children: [],
    };
  }
  if (segment.kind === "emoji") {
    return {
      type: "element",
      tagName: "communityemoji",
      properties: {
        shortcode: segment.shortcode,
        src: segment.url,
      },
      children: [],
    };
  }
  return {
    type: "element",
    tagName: "communityspoiler",
    properties: { label: segment.value },
    children: [{ type: "text", value: segment.value }],
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
