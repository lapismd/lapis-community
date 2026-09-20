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
  data-addressed={member ? "true" : "false"}
  aria-label="Mention someone"
  {disabled}
  {onclick}
>
  <span
    class="community-composer-mention-button"
    data-ui-component="community-composer-mention-button"
    data-addressed={member ? "true" : "false"}
  >
    <span data-ui-part="composer-mention-at" aria-hidden="true">
      <AtSignIcon />
    </span>
    {#if member}
      <span
        class="community-composer-mention-button__lock"
        data-ui-part="composer-mention-lock"
      >
        <CommunityMemberAvatar {member} size="xsmall" decorative />
      </span>
    {/if}
  </span>
</Button>

<style>
  :global(
      [data-ui-component="button"].community-composer-mention-button-host[data-addressed="true"]
    ) {
    width: auto;
    min-width: 2rem;
    padding-inline: 0.35rem;
  }

  .community-composer-mention-button {
    display: inline-flex;
    align-items: center;
    gap: 0.28rem;
  }

  .community-composer-mention-button [data-ui-part="composer-mention-at"],
  .community-composer-mention-button
    [data-ui-part="composer-mention-at"]
    :global(svg) {
    display: block;
    width: 1rem;
    height: 1rem;
    flex: none;
  }

  .community-composer-mention-button__lock {
    display: grid;
    width: 1.125rem;
    height: 1.125rem;
    flex: none;
    place-items: center;
    overflow: hidden;
  }

  .community-composer-mention-button__lock
    :global([data-ui-component="community-member-avatar"]) {
    --community-member-avatar-size: 1.125rem;

    width: 1.125rem;
    height: 1.125rem;
  }
</style>
