<script lang="ts">
  import { Composer } from "@lapismd/design-core/ai/chat";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { tick } from "svelte";

  import type {
    CommunityCustomEmoji,
    CommunityTopicDraft,
  } from "../../community/index.js";
  import CommunityEmojiPicker from "../community-emoji-picker/CommunityEmojiPicker.svelte";

  let {
    open = $bindable(false),
    forumName,
    communityEmojis = [],
    disabled = false,
    onPublish,
  }: {
    open?: boolean;
    forumName: string;
    communityEmojis?: readonly CommunityCustomEmoji[];
    disabled?: boolean;
    onPublish: (draft: CommunityTopicDraft) => Promise<void>;
  } = $props();

  let content = $state("");
  let error = $state("");
  let pending = $state(false);
  let composer = $state<HTMLDivElement | null>(null);

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
  {#if open}
    <Composer
      bind:ref={composer}
      bind:value={content}
      density="spacious"
      elevation="none"
      disabled={disabled || pending}
      aria-label={`New post in ${forumName}`}
      placeholder="Write your post…"
      onSubmit={publish}
    >
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
    {#if error}<p class="community-topic-composer__error" role="alert">
        {error}
      </p>{/if}
  {:else}
    <Button
      type="button"
      variant="outline"
      class="community-topic-composer__trigger"
      aria-label={`Start a new post in ${forumName}`}
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

  .community-topic-composer__error {
    margin: 0.5rem 0 0;
    color: var(--destructive);
    font-size: 0.8rem;
  }
</style>
