import type { CommunityCustomEmoji } from "../../community/index.js";
import type {
  CommunityMemberModel,
  CommunityRoomModel,
} from "../community-workspace/model.js";
import type {
  CommunityMarkdownSegment,
  CommunityMarkdownSyntaxOptions,
} from "./syntax.js";
import { linkSegmentFromHast, segmentToHast } from "./syntax-hast-links.js";

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
    const mentionLink = linkSegmentFromHast(child, options.members());
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
