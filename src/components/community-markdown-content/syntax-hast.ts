import type { CommunityCustomEmoji } from "../../community/index.js";
import {
  contentMentionFromHref,
  contentMentionLabel,
} from "../../community/content-mentions.js";
import type {
  CommunityMemberModel,
  CommunityRoomModel,
} from "../community-workspace/model.js";
import type {
  CommunityMarkdownSegment,
  CommunityMarkdownSyntaxOptions,
} from "./syntax.js";

export type CommunityMarkdownHastNode = {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: CommunityMarkdownHastNode[];
};

export type CommunityMarkdownTokenizer = (
  value: string,
  members: readonly CommunityMemberModel[],
  rooms: readonly CommunityRoomModel[],
  emojis: readonly CommunityCustomEmoji[],
  mentionPubkeys: readonly string[],
) => CommunityMarkdownSegment[];

export function applyCommunityMarkdownSyntax(
  tree: CommunityMarkdownHastNode,
  options: CommunityMarkdownSyntaxOptions,
  tokenize: CommunityMarkdownTokenizer,
): void {
  transformChildren(tree, options, tokenize, []);
}

function transformChildren(
  node: CommunityMarkdownHastNode,
  options: CommunityMarkdownSyntaxOptions,
  tokenize: CommunityMarkdownTokenizer,
  ancestors: string[],
): void {
  if (!Array.isArray(node.children)) return;
  const currentAncestors =
    node.tagName === undefined ? ancestors : [...ancestors, node.tagName];
  const skipText = currentAncestors.some((tag) =>
    ["a", "code", "pre", "script", "style"].includes(tag),
  );

  const nextChildren: CommunityMarkdownHastNode[] = [];
  for (const child of node.children) {
    const mentionLink = memberSegmentFromNostrHref(child, options.members());
    if (mentionLink) {
      nextChildren.push(segmentToHast(mentionLink));
      continue;
    }
    if (child.type === "text" && typeof child.value === "string" && !skipText) {
      nextChildren.push(
        ...tokenize(
          child.value,
          options.members(),
          options.rooms(),
          options.emojis(),
          options.mentionPubkeys(),
        ).map(segmentToHast),
      );
      continue;
    }
    transformChildren(child, options, tokenize, currentAncestors);
    nextChildren.push(child);
  }
  node.children = nextChildren;
}

function memberSegmentFromNostrHref(
  node: CommunityMarkdownHastNode,
  members: readonly CommunityMemberModel[],
): CommunityMarkdownSegment | undefined {
  if (node.tagName !== "a") return undefined;
  const mention = contentMentionFromHref(
    typeof node.properties?.href === "string"
      ? node.properties.href
      : undefined,
  );
  if (!mention) return undefined;
  return {
    kind: "member",
    memberId: mention.pubkey,
    value: contentMentionLabel(mention.pubkey, mention.value, members),
  };
}

function segmentToHast(
  segment: CommunityMarkdownSegment,
): CommunityMarkdownHastNode {
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
