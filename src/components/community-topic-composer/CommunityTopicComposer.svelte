<script lang="ts">
  import { Composer, type ComposerStatus } from "@lapismd/design-core/ai/chat";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
  import XIcon from "@lucide/svelte/icons/x";
  import { tick } from "svelte";

  import type {
    CommunityCustomEmoji,
    CommunityTopicDraft,
  } from "../../community/index.js";
  import "../community-composer-status.css";
  import CommunityEmojiPicker from "../community-emoji-picker/CommunityEmojiPicker.svelte";

  let {
    open = $bindable(false),
    forumName,
    communityEmojis = [],
    disabled = false,
    disabledReason = "Posting is unavailable",
    composerStatus,
    onRetryComposerStatus,
    onDismissComposerStatus,
    onPublish,
  }: {
    open?: boolean;
    forumName: string;
    communityEmojis?: readonly CommunityCustomEmoji[];
    disabled?: boolean;
    disabledReason?: string;
    composerStatus?: ComposerStatus;
    onRetryComposerStatus?: () => void | Promise<void>;
    onDismissComposerStatus?: () => void;
    onPublish: (draft: CommunityTopicDraft) => Promise<void>;
  } = $props();

  let content = $state("");
  let error = $state("");
  let pending = $state(false);
  let composer = $state<HTMLDivElement | null>(null);
  const displayedStatus = $derived<ComposerStatus | undefined>(
    error ? { type: "error", message: error } : composerStatus,
  );
  const expanded = $derived(open || displayedStatus !== undefined);

  async function expand(): Promise<void> {
    if (disabled) return;
    open = true;
    error = "";
    await tick();
    composer?.querySelector<HTMLElement>('[data-ui-part="editable"]')?.focus();
  }

  function cancel(): void {
    open = false;
    content = "";
    error = "";
  }

  async function publish(value: string): Promise<void> {
    const normalized = value.trim();
    if (!normalized || pending) return;
    error = "";
    pending = true;
    try {
      const firstLine = normalized.split(/\r?\n/u)[0] ?? normalized;
      await onPublish({
        title:
          firstLine.length > 120
            ? `${firstLine.slice(0, 119).trimEnd()}…`
            : firstLine,
        content: normalized,
        tags: [],
      });
      open = false;
      content = "";
    } catch (cause) {
      error =
        cause instanceof Error ? cause.message : "Topic could not be published";
      content = normalized;
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
    <Composer
      bind:ref={composer}
      bind:value={content}
      density="spacious"
      elevation="none"
      disabled={disabled || pending}
      {...displayedStatus === undefined ? {} : { status: displayedStatus }}
      statusPosition="top"
      interactiveDrawerWhenDisabled={displayedStatus !== undefined}
      aria-label={`New post in ${forumName}`}
      placeholder="Write your post…"
      onSubmit={publish}
    >
      {#snippet drawer()}
        {#if displayedStatus && (onRetryComposerStatus || onDismissComposerStatus)}
          <span
            class="community-composer-status-actions"
            data-ui-part="composer-status-actions"
          >
            {#if onRetryComposerStatus}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Retry"
                title="Retry"
                onclick={onRetryComposerStatus}
              >
                <RotateCcwIcon aria-hidden="true" />
              </Button>
            {/if}
            {#if onDismissComposerStatus}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Dismiss"
                title="Dismiss"
                onclick={onDismissComposerStatus}
              >
                <XIcon aria-hidden="true" />
              </Button>
            {/if}
          </span>
        {/if}
      {/snippet}
      {#snippet footerActions()}
        <CommunityEmojiPicker
          {communityEmojis}
          label="Add emoji to post"
          onSelect={(emoji) => (content += emoji)}
        />
      {/snippet}
      {#snippet sendActions()}
        <Button type="button" variant="ghost" size="sm" onclick={cancel}
          >Cancel</Button
        >
      {/snippet}
    </Composer>
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
    --ui-ai-chat-composer-radius: 0.85rem;

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
    font-size: 0.95rem;
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

  .community-topic-composer[data-expanded]
    :global([data-ui-component="ai-chat-composer"]) {
    min-height: 7.5rem;
  }

  .community-topic-composer[data-expanded]
    :global([data-ui-component="ai-chat-composer"] [data-ui-part="body"]) {
    min-height: 7.5rem;
    border-color: var(--border);
    background: var(--background);
  }

  .community-topic-composer[data-expanded]
    :global(
      [data-ui-component="ai-chat-composer"] [data-ui-part="input-area"]
    ) {
    min-height: 3.25rem;
  }
</style>
