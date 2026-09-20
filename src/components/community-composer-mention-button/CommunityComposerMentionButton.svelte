<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import AtSignIcon from "@lucide/svelte/icons/at-sign";
  import XIcon from "@lucide/svelte/icons/x";

  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import { communityMemberAvatarShape } from "../community-member-avatar/model.js";
  import type { CommunityMemberModel } from "../community-workspace/model.js";

  let {
    member,
    disabled = false,
    onclick,
    onDismiss,
  }: {
    member?: CommunityMemberModel | undefined;
    disabled?: boolean;
    onclick: () => void | Promise<void>;
    onDismiss?: ((pubkey: string) => void) | undefined;
  } = $props();

  const lockShape = $derived(
    member ? communityMemberAvatarShape(member) : "rounded",
  );
</script>

<span
  class="community-composer-mention-button"
  data-ui-component="community-composer-mention-button"
  data-addressed={member ? "true" : "false"}
>
  <Button
    type="button"
    variant="ghost"
    size="icon-sm"
    class="community-composer-mention-button-host"
    aria-label="Mention someone"
    {disabled}
    {onclick}
  >
    <span data-ui-part="composer-mention-at" aria-hidden="true">
      <AtSignIcon />
    </span>
  </Button>
  {#if member}
    <button
      type="button"
      class="community-composer-mention-button__lock"
      data-ui-part="composer-mention-lock"
      data-shape={lockShape}
      aria-label={`Don't automatically mention ${member.name} in this thread`}
      {disabled}
      onmousedown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onclick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onDismiss?.(member.id);
      }}
    >
      <CommunityMemberAvatar {member} size="xsmall" decorative />
      <span
        class="community-composer-mention-button__dismiss"
        data-ui-part="composer-mention-dismiss"
        aria-hidden="true"
      >
        <XIcon />
      </span>
    </button>
  {/if}
</span>

<style>
  .community-composer-mention-button {
    display: inline-flex;
    align-items: center;
    gap: 0.12rem;
  }

  .community-composer-mention-button[data-addressed="true"] {
    height: 2rem;
    padding: 0 0.35rem 0 0.55rem;
    gap: 0.3rem;
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--foreground) 10%, var(--background));
    color: var(--foreground);
  }

  .community-composer-mention-button[data-addressed="true"]
    :global([data-ui-component="button"]) {
    width: auto;
    height: auto;
    min-width: 0;
    padding: 0;
    background: transparent;
    color: inherit;
  }

  .community-composer-mention-button[data-addressed="true"]
    :global([data-ui-component="button"]:hover),
  .community-composer-mention-button[data-addressed="true"]
    :global([data-ui-component="button"]:focus-visible) {
    background: transparent;
  }

  .community-composer-mention-button[data-addressed="true"]
    :global([data-ui-component="button"]:active) {
    translate: none;
  }

  .community-composer-mention-button [data-ui-part="composer-mention-at"],
  .community-composer-mention-button
    [data-ui-part="composer-mention-at"]
    :global(svg) {
    display: block;
    width: 1rem;
    height: 1rem;
  }

  .community-composer-mention-button__lock {
    position: relative;
    display: grid;
    width: 1.125rem;
    height: 1.125rem;
    flex: none;
    place-items: center;
    padding: 0;
    overflow: hidden;
    border: 0;
    background: transparent;
    cursor: pointer;
  }

  .community-composer-mention-button__lock
    :global([data-ui-component="community-member-avatar"]) {
    --community-member-avatar-size: 1.125rem;

    width: 1.125rem;
    height: 1.125rem;
  }

  .community-composer-mention-button__dismiss {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--foreground);
    color: var(--background);
    opacity: 0;
    pointer-events: none;
  }

  .community-composer-mention-button__lock[data-shape="rounded"]
    .community-composer-mention-button__dismiss {
    border-radius: 25%;
  }

  .community-composer-mention-button__lock:hover
    .community-composer-mention-button__dismiss,
  .community-composer-mention-button__lock:focus-visible
    .community-composer-mention-button__dismiss {
    opacity: 1;
  }

  .community-composer-mention-button__dismiss :global(svg) {
    width: 0.7rem;
    height: 0.7rem;
  }
</style>
