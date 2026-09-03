<script lang="ts">
  import { Composer } from "@lapismd/design-core/ai/chat";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Popover from "@lapismd/design-core/shadcn/popover";
  import ReplyIcon from "@lucide/svelte/icons/reply";
  import XIcon from "@lucide/svelte/icons/x";
  import { tick } from "svelte";

  import CommunityEmojiPicker from "../community-emoji-picker/CommunityEmojiPicker.svelte";
  import {
    displayName,
    avatarHue,
    initials,
    type CommunityProfile,
    type ForumPost,
  } from "../registry-community/model.js";

  let {
    element = $bindable(),
    name,
    replyingTo,
    profiles,
    postNumber,
    signedInPubkey,
    publishing = false,
    comment = $bindable(""),
    onCancel,
    onSubmit,
  }: {
    element?: HTMLDivElement | undefined;
    name: string;
    replyingTo?: ForumPost | undefined;
    profiles: ReadonlyMap<string, CommunityProfile>;
    postNumber: (eventId: string) => number;
    signedInPubkey: string;
    publishing?: boolean;
    comment?: string;
    onCancel: () => void;
    onSubmit: (content: string) => boolean | void | Promise<boolean | void>;
  } = $props();

  const signedInProfile = $derived(profiles.get(signedInPubkey));
  const signedInName = $derived(
    signedInPubkey === "" ? "" : displayName(signedInPubkey, profiles),
  );
  let open = $state(false);
  let composer = $state<HTMLDivElement | null>(null);

  $effect(() => {
    if (replyingTo === undefined && comment.trim() === "") return;
    open = true;
    void focusComposer();
  });

  function shortKey(value: string): string {
    return value.length > 16
      ? `${value.slice(0, 8)}…${value.slice(-8)}`
      : value;
  }

  async function focusComposer(): Promise<void> {
    await tick();
    composer?.querySelector<HTMLElement>('[data-ui-part="editable"]')?.focus();
  }

  async function expand(): Promise<void> {
    open = true;
    await focusComposer();
  }

  function cancelReply(): void {
    onCancel();
  }

  function cancelComposer(): void {
    onCancel();
    comment = "";
    open = false;
  }

  async function publish(value: string): Promise<void> {
    comment = value;
    try {
      const published = await onSubmit(value);
      if (published === false) {
        comment = value;
        return;
      }
      comment = "";
      open = false;
    } catch {
      comment = value;
    }
  }
</script>

<div
  class="discussion-composer"
  data-expanded={open ? "" : undefined}
  data-ui-component="discussion-composer"
  bind:this={element}
>
  {#if open}
    <Composer
      bind:ref={composer}
      bind:value={comment}
      density="spacious"
      elevation="none"
      disabled={publishing}
      aria-label={replyingTo
        ? "Reply to discussion"
        : `Discussion about ${name}`}
      placeholder={replyingTo ? "Write your reply…" : "Write your post…"}
      onSubmit={publish}
    >
      {#snippet drawer()}
        {#if replyingTo}
          <div
            class="discussion-composer__reply"
            role="group"
            aria-label={`Replying to ${displayName(replyingTo.event.pubkey, profiles)}`}
          >
            <span>
              <ReplyIcon aria-hidden="true" />
              <strong>
                Replying to {displayName(replyingTo.event.pubkey, profiles)} · post
                #{postNumber(replyingTo.event.id)}
              </strong>
              <small title={replyingTo.content}>{replyingTo.content}</small>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Cancel reply"
              onclick={cancelReply}
            >
              <XIcon aria-hidden="true" />
            </Button>
          </div>
        {/if}
      {/snippet}
      {#snippet footerActions()}
        <CommunityEmojiPicker
          label="Add emoji to discussion"
          onSelect={(emoji) => (comment += emoji)}
        />
        {#if signedInPubkey === ""}
          <span class="discussion-composer__signer-note">
            A NIP-07 signer is required to publish.
          </span>
        {:else}
          <Popover.Root>
            <Popover.Trigger>
              {#snippet child({ props })}
                <Button
                  {...props}
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="discussion-composer__identity"
                  aria-label={`Open profile for ${signedInName}`}
                >
                  <span
                    class="discussion-composer__avatar"
                    style={`--avatar-hue: ${avatarHue(signedInPubkey)}`}
                    aria-hidden="true"
                  >
                    {#if signedInProfile?.picture}
                      <img src={signedInProfile.picture} alt="" />
                    {:else}
                      {initials(signedInName)}
                    {/if}
                  </span>
                  <span>{signedInName}</span>
                </Button>
              {/snippet}
            </Popover.Trigger>
            <Popover.Content align="start" class="discussion-composer__profile">
              <div class="discussion-composer__profile-heading">
                <span
                  class="discussion-composer__avatar discussion-composer__avatar--large"
                  style={`--avatar-hue: ${avatarHue(signedInPubkey)}`}
                  aria-hidden="true"
                >
                  {#if signedInProfile?.picture}
                    <img src={signedInProfile.picture} alt="" />
                  {:else}
                    {initials(signedInName)}
                  {/if}
                </span>
                <div>
                  <Popover.Title><h3>{signedInName}</h3></Popover.Title>
                  <p>{shortKey(signedInPubkey)}</p>
                </div>
              </div>
              <Popover.Description>
                {signedInProfile?.about ?? "Nostr community profile"}
              </Popover.Description>
            </Popover.Content>
          </Popover.Root>
        {/if}
      {/snippet}
      {#snippet sendActions()}
        <Button type="button" variant="ghost" size="sm" onclick={cancelComposer}
          >Cancel</Button
        >
      {/snippet}
    </Composer>
  {:else}
    <Button
      type="button"
      variant="outline"
      class="discussion-composer__trigger"
      aria-label={`Start a discussion about ${name}`}
      disabled={publishing}
      onclick={expand}
    >
      Start a discussion…
    </Button>
  {/if}
</div>

<style>
  .discussion-composer {
    --ui-ai-chat-composer-radius: 0.85rem;

    width: 100%;
    scroll-margin-top: 6rem;
  }

  :global(.discussion-composer__trigger[data-ui-component="button"]) {
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

  :global(.discussion-composer__trigger[data-ui-component="button"]:hover),
  :global(
      .discussion-composer__trigger[data-ui-component="button"]:focus-visible
    ) {
    border-color: var(--border);
    color: var(--foreground);
    background: color-mix(in srgb, var(--foreground) 3%, transparent);
  }

  .discussion-composer[data-expanded]
    :global([data-ui-component="ai-chat-composer"]) {
    min-height: 7.5rem;
  }

  .discussion-composer[data-expanded]
    :global([data-ui-component="ai-chat-composer"] [data-ui-part="body"]) {
    min-height: 7.5rem;
    border-color: var(--border);
    background: var(--background);
  }

  .discussion-composer[data-expanded]
    :global(
      [data-ui-component="ai-chat-composer"] [data-ui-part="input-area"]
    ) {
    min-height: 3.25rem;
  }

  .discussion-composer__reply {
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.625rem 0.75rem 0;
    background: color-mix(in srgb, var(--foreground) 4%, var(--background));
  }

  .discussion-composer__reply > span {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    min-width: 0;
    flex: 1;
    column-gap: 0.35rem;
    row-gap: 0.1rem;
  }

  .discussion-composer__reply strong {
    grid-column: 2;
    font-size: 0.78rem;
    font-weight: 600;
    line-height: 1rem;
  }

  .discussion-composer__reply > span > :global(svg) {
    grid-row: 1 / span 2;
    grid-column: 1;
    width: 0.8rem;
    height: 0.8rem;
    margin-block-start: 0.1rem;
  }

  .discussion-composer__reply small {
    display: block;
    grid-column: 2;
    overflow: hidden;
    color: var(--muted-foreground);
    font-size: 0.72rem;
    line-height: 1rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .discussion-composer__signer-note {
    color: var(--muted-foreground);
    font-size: 0.78rem;
  }

  :global(.discussion-composer__identity) {
    max-width: min(100%, 20rem);
    justify-content: flex-start;
    padding-inline-start: 0.3rem;
    color: var(--foreground);
  }

  .discussion-composer__avatar {
    display: grid;
    width: 1.65rem;
    height: 1.65rem;
    flex: 0 0 auto;
    place-items: center;
    overflow: hidden;
    border: 1px solid hsl(var(--avatar-hue) 55% 55% / 0.48);
    border-radius: 50%;
    background: hsl(var(--avatar-hue) 42% 28%);
    color: hsl(var(--avatar-hue) 70% 90%);
    font-size: 0.62rem;
    font-weight: 700;
  }

  .discussion-composer__avatar--large {
    width: 2.75rem;
    height: 2.75rem;
    font-size: 0.85rem;
  }

  .discussion-composer__avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  :global(.discussion-composer__profile) {
    display: grid;
    gap: 0.75rem;
    width: min(20rem, calc(100vw - 1rem));
  }

  .discussion-composer__profile-heading {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .discussion-composer__profile-heading h3 {
    margin: 0;
    font-size: 0.95rem;
  }

  p {
    margin: 0;
    color: var(--muted-foreground);
    font-size: 0.78rem;
  }
</style>
