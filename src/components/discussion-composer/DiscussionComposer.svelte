<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { Textarea } from "@lapismd/design-core/shadcn/textarea";

  import {
    displayName,
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

  function shortKey(value: string): string {
    return value.length > 16
      ? `${value.slice(0, 8)}…${value.slice(-8)}`
      : value;
  }
</script>

<div class="comment-form" bind:this={element}>
  <div class="composer-heading">
    <div>
      <span class="field-label">
        {replyingTo === undefined ? "Add to the discussion" : "Reply to a post"}
      </span>
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
    id="registry-comment"
    bind:value={comment}
    maxlength={10000}
    rows={5}
    placeholder={`Share your experience with ${name}`}
    disabled={publishing}
  />
  <div class="form-footer">
    <span>
      {signedInPubkey === ""
        ? "A NIP-07 signer is required to publish."
        : shortKey(signedInPubkey)}
    </span>
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
