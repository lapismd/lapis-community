<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Popover from "@lapismd/design-core/shadcn/popover";
  import { Textarea } from "@lapismd/design-core/shadcn/textarea";

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
    onConnect,
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
    onConnect: () => void | Promise<void>;
    onSubmit: () => void | Promise<void>;
  } = $props();

  const signedInProfile = $derived(profiles.get(signedInPubkey));
  const signedInName = $derived(
    signedInPubkey === "" ? "" : displayName(signedInPubkey, profiles),
  );

  function shortKey(value: string): string {
    return value.length > 16
      ? `${value.slice(0, 8)}…${value.slice(-8)}`
      : value;
  }
</script>

<div class="comment-form" bind:this={element}>
  <div class="composer-heading">
    <div>
      <label class="field-label" for="registry-comment">
        {replyingTo === undefined ? "Add to the discussion" : "Reply to a post"}
      </label>
      {#if replyingTo}
        <p>
          Replying to {displayName(replyingTo.event.pubkey, profiles)} · post #{postNumber(
            replyingTo.event.id,
          )}
        </p>
      {:else}
        <p>Post a top-level comment about {name}.</p>
      {/if}
    </div>
    {#if replyingTo}
      <Button variant="ghost" size="sm" onclick={onCancel}>Cancel</Button>
    {/if}
  </div>
  <Textarea
    class="discussion-composer__input"
    id="registry-comment"
    bind:value={comment}
    maxlength={10000}
    rows={5}
    placeholder={`Share your experience with ${name}`}
    disabled={publishing}
  />
  <div class="form-footer">
    {#if signedInPubkey === ""}
      <span>A NIP-07 signer is required to publish.</span>
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
    <div class="actions">
      {#if signedInPubkey === ""}
        <Button
          variant="outline"
          size="sm"
          disabled={publishing}
          onclick={onConnect}>Connect Nostr</Button
        >
      {/if}
      <Button
        size="sm"
        disabled={publishing || comment.trim() === ""}
        onclick={onSubmit}
      >
        {replyingTo ? "Publish reply" : "Publish comment"}
      </Button>
    </div>
  </div>
</div>

<style>
  .comment-form {
    display: grid;
    gap: 0.75rem;
    margin-top: 1rem;
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: color-mix(in oklch, var(--card) 88%, var(--secondary));
    scroll-margin-top: 6rem;
  }

  .composer-heading,
  .form-footer,
  .actions {
    display: flex;
    align-items: center;
  }

  .composer-heading,
  .form-footer {
    justify-content: space-between;
    gap: 1rem;
  }

  :global(.discussion-composer__input[data-ui-component="textarea"]) {
    background: var(--background);
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

  .field-label {
    font-size: 0.95rem;
    font-weight: 650;
  }

  p {
    margin: 0;
    color: var(--muted-foreground);
    font-size: 0.78rem;
  }

  .form-footer {
    color: var(--muted-foreground);
    font-size: 0.78rem;
  }

  .actions {
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  @media (max-width: 44rem) {
    .composer-heading,
    .form-footer {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>
