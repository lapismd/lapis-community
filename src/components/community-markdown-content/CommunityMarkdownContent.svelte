<script lang="ts">
  import "@lapismd/mira/styles.css";

  import { MarkdownPreview } from "@lapismd/mira/preview";
  import { setContext } from "svelte";

  import type { CommunityCustomEmoji } from "../../community/index.js";
  import type {
    CommunityMemberModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";
  import {
    communityMarkdownInteractionContext,
    type CommunityMarkdownInteractionContext,
  } from "./context.js";
  import { createCommunityMarkdownExtension } from "./syntax.js";

  let {
    content,
    fullWidth = false,
    mentionPubkeys = [],
    members = [],
    rooms = [],
    communityEmojis = [],
    onOpenMember,
    onMessageMember,
    onWaveMember,
    onOpenRoom,
    class: className = "",
  }: {
    content: string;
    /** Fill the parent column instead of centering a readable-width document. */
    fullWidth?: boolean;
    mentionPubkeys?: readonly string[];
    members?: readonly CommunityMemberModel[];
    rooms?: readonly CommunityRoomModel[];
    communityEmojis?: readonly CommunityCustomEmoji[];
    onOpenMember?: (member: CommunityMemberModel) => void;
    onMessageMember?: (member: CommunityMemberModel) => void | Promise<void>;
    onWaveMember?: (member: CommunityMemberModel) => void | Promise<void>;
    onOpenRoom?: (roomId: string) => void;
    class?: string;
  } = $props();

  setContext<CommunityMarkdownInteractionContext>(
    communityMarkdownInteractionContext,
    {
      member(id) {
        return members.find((member) => member.id === id);
      },
      get onOpenMember() {
        return onOpenMember;
      },
      get onMessageMember() {
        return onMessageMember;
      },
      get onWaveMember() {
        return onWaveMember;
      },
      get onOpenRoom() {
        return onOpenRoom;
      },
    },
  );

  const communityMarkdownExtension = createCommunityMarkdownExtension({
    members: () => members,
    rooms: () => rooms,
    emojis: () => communityEmojis,
    mentionPubkeys: () => mentionPubkeys,
  });
</script>

<div
  class={`community-markdown-content ${className}`.trim()}
  data-ui-component="community-markdown-content"
  data-full-width={fullWidth}
>
  <MarkdownPreview
    value={content}
    extensions={[communityMarkdownExtension]}
    htmlPolicy="safe"
    highlight
  />
</div>

<style>
  .community-markdown-content {
    --mira-preview-padding: 0;
    --mira-preview-bottom-padding: 0;
    --mira-font-sans: var(--font-sans, ui-sans-serif, system-ui, sans-serif);
    --mira-font-mono: var(--font-mono, ui-monospace, monospace);
    --mira-font-size: inherit;
    --mira-line-height: 1.55;

    min-width: 0;
    color: var(--foreground);
    overflow-wrap: anywhere;
  }

  :global(.community-markdown-content .mira-markdown-preview) {
    height: auto;
    padding: 0;
    overflow: visible;
  }

  :global(.community-markdown-content .markdown-preview-surface) {
    min-height: 0;
    gap: 0.55rem;
    background: transparent;
  }

  .community-markdown-content[data-full-width="true"]
    :global(.markdown-preview-surface) {
    --file-line-width: 100%;
  }

  :global(.community-markdown-content .markdown-view__document) {
    padding: 0;
  }

  :global(.community-markdown-content :is(p, ul, ol, blockquote, pre, table)) {
    margin-block: 0.45rem;
  }

  :global(.community-markdown-content :first-child) {
    margin-block-start: 0;
  }

  :global(.community-markdown-content :last-child) {
    margin-block-end: 0;
  }

  :global(.community-markdown-content pre) {
    max-width: 100%;
    overflow-x: auto;
  }

  :global(.community-markdown-content table) {
    display: block;
    max-width: 100%;
    overflow-x: auto;
  }

  :global(
      .community-markdown-content
        .markdown-rendered
        .markdown
        img.community-emoji-reference
    ) {
    display: inline-block;
    width: 1.15em;
    height: 1.15em;
    max-width: none;
    margin-inline: 0.04em;
    object-fit: contain;
    vertical-align: -0.2em;
  }

  :global(.community-markdown-content img:not(.community-emoji-reference)) {
    max-width: min(100%, 32rem);
    max-height: 24rem;
    border-radius: calc(var(--radius) * 1.15);
    object-fit: contain;
  }
</style>
