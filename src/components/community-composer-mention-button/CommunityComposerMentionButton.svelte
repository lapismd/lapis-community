<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import AtSignIcon from "@lucide/svelte/icons/at-sign";

  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import type { CommunityMemberModel } from "../community-workspace/model.js";

  let {
    member,
    disabled = false,
    onclick,
  }: {
    member?: CommunityMemberModel | undefined;
    disabled?: boolean;
    onclick: () => void | Promise<void>;
  } = $props();
</script>

<Button
  type="button"
  variant="ghost"
  size="icon-sm"
  class="community-composer-mention-button-host"
  aria-label="Mention someone"
  {disabled}
  {onclick}
>
  <span
    class="community-composer-mention-button"
    data-ui-component="community-composer-mention-button"
    data-addressed={member ? "true" : "false"}
  >
    <AtSignIcon aria-hidden="true" />
    {#if member}
      <span
        class="community-composer-mention-button__lock"
        data-ui-part="composer-mention-lock"
      >
        <CommunityMemberAvatar {member} size="inline" decorative />
      </span>
    {/if}
  </span>
</Button>

<style>
  :global(.community-composer-mention-button-host) {
    overflow: visible;
  }

  .community-composer-mention-button {
    position: relative;
    display: inline-grid;
    width: 1rem;
    height: 1rem;
    place-items: center;
  }

  .community-composer-mention-button :global(svg) {
    width: 1rem;
    height: 1rem;
  }

  .community-composer-mention-button__lock {
    position: absolute;
    right: -0.28rem;
    bottom: -0.22rem;
    display: grid;
    width: 0.78rem;
    height: 0.78rem;
    place-items: center;
    overflow: hidden;
    border: 0.1rem solid var(--background, white);
    border-radius: 0.28rem;
    pointer-events: none;
  }

  .community-composer-mention-button__lock
    :global([data-ui-component="community-member-avatar"]) {
    --community-member-avatar-size: 0.58rem;

    width: 0.58rem;
    height: 0.58rem;
  }
</style>
