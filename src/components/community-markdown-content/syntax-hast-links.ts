import {
  contentMentionFromHref,
  contentMentionLabel,
} from "../../community/content-mentions.js";
import type { CommunityMemberModel } from "../community-workspace/model.js";
import { entitySegmentFromHref } from "./syntax-entity.js";
import type { CommunityMarkdownHastNode } from "./syntax-hast.js";
import type { CommunityMarkdownSegment } from "./syntax.js";

export function linkSegmentFromHast(
  node: CommunityMarkdownHastNode,
  members: readonly CommunityMemberModel[],
): CommunityMarkdownSegment | undefined {
  if (node.tagName !== "a" && node.tagName !== "pathlink") return undefined;
  const href =
    typeof node.properties?.href === "string"
      ? node.properties.href
      : undefined;
  const mention = contentMentionFromHref(href);
  if (mention) {
    return {
      kind: "member",
      memberId: mention.pubkey,
      value: contentMentionLabel(mention.pubkey, mention.value, members),
    };
  }
  return entitySegmentFromHref(href, hastText(node));
}

export function segmentToHast(
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
  if (segment.kind === "entity") {
    return {
      type: "element",
      tagName: "communityentity",
      properties: { href: segment.href, label: segment.value },
      children: [],
    };
  }
  if (segment.kind === "emoji") {
    return {
      type: "element",
      tagName: "communityemoji",
      properties: { shortcode: segment.shortcode, src: segment.url },
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

function hastText(node: CommunityMarkdownHastNode): string {
  if (typeof node.value === "string") return node.value;
  return (node.children ?? []).map(hastText).join("");
}
