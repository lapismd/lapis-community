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
import CommunityEntityReference from "./CommunityEntityReference.svelte";
import CommunityMemberReference from "./CommunityMemberReference.svelte";
import CommunitySpoiler from "./CommunitySpoiler.svelte";
import {
  applyCommunityMarkdownSyntax,
  type CommunityMarkdownHastNode,
} from "./syntax-hast.js";
import {
  tokenizeCommunityMarkdownText,
  type CommunityMarkdownSegment,
} from "./syntax-tokens.js";

export type { CommunityMarkdownSegment };

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
      communityentity: CommunityEntityReference,
      communitymember: CommunityMemberReference,
      communityspoiler: CommunitySpoiler,
    },
    rehypePlugins: [rehypeCommunitySyntax],
  });
}

export { tokenizeCommunityMarkdownText };
