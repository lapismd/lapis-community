<script lang="ts">
  import type { ComposerStatus } from "@lapismd/design-core/ai/chat";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { tick } from "svelte";

  import type {
    CommunityCustomEmoji,
    CommunityTopicDraft,
  } from "../../community/index.js";
  import CommunityTopicComposerEditor from "./CommunityTopicComposerEditor.svelte";
  import type {
    CommunityMemberModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";

  let {
    open = $bindable(false),
    forumName,
    members = [],
    rooms = [],
    communityEmojis = [],
    currentMemberId,
    disabled = false,
    disabledReason = "Posting is unavailable",
    composerStatus,
    onRetryComposerStatus,
    onDismissComposerStatus,
    onPublish,
  }: {
    open?: boolean;
    forumName: string;
    members?: readonly CommunityMemberModel[];
    rooms?: readonly CommunityRoomModel[];
    communityEmojis?: readonly CommunityCustomEmoji[];
    currentMemberId?: string;
    disabled?: boolean;
    disabledReason?: string;
    composerStatus?: ComposerStatus;
    onRetryComposerStatus?: () => void | Promise<void>;
    onDismissComposerStatus?: () => void;
    onPublish: (draft: CommunityTopicDraft) => Promise<void>;
  } = $props();

  let content = $state("");
  let pending = $state(false);
  let composer = $state<HTMLDivElement | null>(null);
  const expanded = $derived(open || composerStatus !== undefined);

  async function expand(): Promise<void> {
    if (disabled) return;
    open = true;
    await tick();
    composer
      ?.querySelector<HTMLElement>(
        '[data-ui-part="editable"], .cm-content[contenteditable="true"]',
      )
      ?.focus();
  }

  async function publish(draft: CommunityTopicDraft): Promise<void> {
    if (pending) return;
    pending = true;
    try {
      await onPublish(draft);
      open = false;
    } finally {
      pending = false;
    }
  }
</script>

<div
  class="community-topic-composer"
  data-expanded={open ? "" : undefined}
  data-ui-component="community-topic-composer"
>
  {#if expanded}
    <CommunityTopicComposerEditor
      bind:open
      bind:content
      bind:composer
      {forumName}
      {members}
      {rooms}
      {communityEmojis}
      {disabled}
      {disabledReason}
      {pending}
      onPublish={publish}
      {...currentMemberId === undefined ? {} : { currentMemberId }}
      {...composerStatus === undefined ? {} : { composerStatus }}
      {...onRetryComposerStatus === undefined ? {} : { onRetryComposerStatus }}
      {...onDismissComposerStatus === undefined
        ? {}
        : { onDismissComposerStatus }}
    />
  {:else}
    <Button
      type="button"
      variant="outline"
      class="community-topic-composer__trigger"
      aria-label={`Start a new post in ${forumName}`}
      title={disabled ? disabledReason : undefined}
      {disabled}
      onclick={expand}
    >
      Start a new post…
    </Button>
  {/if}
</div>

<style>
  .community-topic-composer {
    width: 100%;
  }

  :global(.community-topic-composer__trigger[data-ui-component="button"]) {
    width: 100%;
    height: 3.25rem;
    justify-content: flex-start;
    border-style: dashed;
    border-color: color-mix(in srgb, var(--border) 72%, transparent);
    border-radius: 0.75rem;
    padding-inline: 1rem;
    color: var(--muted-foreground);
    background: transparent;
    font-size: var(--community-text-body);
    font-weight: 400;
  }

  :global(.community-topic-composer__trigger[data-ui-component="button"]:hover),
  :global(
      .community-topic-composer__trigger[data-ui-component="button"]:focus-visible
    ) {
    border-color: var(--border);
    color: var(--foreground);
    background: color-mix(in srgb, var(--foreground) 3%, transparent);
  }
</style>
