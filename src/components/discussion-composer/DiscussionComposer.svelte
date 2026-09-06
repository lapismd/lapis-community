<script lang="ts">
  import type { ComposerStatus } from "@lapismd/design-core/ai/chat";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Popover from "@lapismd/design-core/shadcn/popover";
  import { tick } from "svelte";

  import CommunityChatComposer from "../community-chat-composer/CommunityChatComposer.svelte";
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
    composerStatus,
    onDismissComposerStatus,
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
    composerStatus?: ComposerStatus;
    onDismissComposerStatus?: () => void;
    comment?: string;
    onCancel: () => void;
    onSubmit: (content: string) => boolean | void | Promise<boolean | void>;
  } = $props();

  const signedInProfile = $derived(profiles.get(signedInPubkey));
  const signedInName = $derived(
    signedInPubkey === "" ? "" : displayName(signedInPubkey, profiles),
  );
  const members = $derived(
    [...profiles.values()].map((profile) => ({
      id: profile.pubkey,
      name: profile.name,
      handle: shortKey(profile.pubkey),
      initials: initials(profile.name),
      ...(profile.picture === undefined ? {} : { avatarUrl: profile.picture }),
    })),
  );
  const replyContext = $derived(
    replyingTo === undefined
      ? undefined
      : {
          kind: "reply" as const,
          target: {
            eventId: replyingTo.event.id,
            roomId: name,
            authorId: replyingTo.event.pubkey,
            authorName: displayName(replyingTo.event.pubkey, profiles),
            content: replyingTo.content,
            kind: "forum" as const,
          },
        },
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
    composer
      ?.querySelector<HTMLElement>(
        '[data-ui-part="editable"], .cm-content[contenteditable="true"]',
      )
      ?.focus();
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
        throw new Error(
          composerStatus?.message ?? "Comment could not be published",
        );
      }
      comment = "";
      open = false;
    } catch (cause) {
      comment = value;
      throw cause;
    }
  }
</script>

{#snippet identityAction()}
  {#if signedInPubkey !== ""}
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

<div
  class="discussion-composer"
  data-expanded={open ? "" : undefined}
  data-reply-post={replyingTo ? postNumber(replyingTo.event.id) : undefined}
  data-ui-component="discussion-composer"
  bind:this={element}
>
  {#if open}
    <CommunityChatComposer
      bind:ref={composer}
      bind:value={comment}
      {members}
      {...signedInPubkey === "" ? {} : { currentMemberId: signedInPubkey }}
      {...replyContext === undefined ? {} : { context: replyContext }}
      busy={publishing}
      {...composerStatus === undefined ? {} : { composerStatus }}
      {...onDismissComposerStatus === undefined
        ? {}
        : { onDismissComposerStatus }}
      ariaLabel={replyingTo
        ? "Reply to discussion"
        : `Discussion about ${name}`}
      submitLabel="Publish comment"
      placeholder={replyingTo ? "Write your reply…" : "Write your post…"}
      additionalActions={identityAction}
      onCancel={cancelComposer}
      {...replyingTo === undefined ? {} : { onCancelContext: cancelReply }}
      onSubmit={(submission) => publish(submission.content)}
    />
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
