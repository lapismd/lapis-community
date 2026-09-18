<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import HandIcon from "@lucide/svelte/icons/hand";
  import MessageCircleIcon from "@lucide/svelte/icons/message-circle";
  import UserPlusIcon from "@lucide/svelte/icons/user-plus";

  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import { communityMemberHandleLabel } from "../community-member-avatar/handle.js";
  import type { CommunityMemberModel } from "../community-workspace/model.js";

  let {
    member,
    onCopyPublicKey,
    onMessage,
    onWave,
    onFollow,
  }: {
    member: CommunityMemberModel;
    onCopyPublicKey?: () => void | Promise<void>;
    onMessage?: () => void | Promise<void>;
    onWave?: () => void | Promise<void>;
    onFollow?: () => void | Promise<void>;
  } = $props();
</script>

<article class="community-member-profile">
  <header>
    <CommunityMemberAvatar {member} size="large" showPresence />
    <div>
      <h2>
        {#if onCopyPublicKey}
          <Button
            class="community-member-profile__identity-copy"
            variant="ghost"
            aria-label={`Copy ${member.name}'s public key`}
            onclick={onCopyPublicKey}
          >
            {member.name}<CopyIcon data-icon="inline-end" aria-hidden="true" />
          </Button>
        {:else}
          {member.name}
        {/if}
      </h2>
      <p>{communityMemberHandleLabel(member.handle)}</p>
    </div>
  </header>

  {#if onMessage || onWave || onFollow}
    <div class="community-member-profile__actions">
      {#if onMessage}
        <Button
          class="community-member-profile__action"
          variant="secondary"
          onclick={onMessage}
        >
          <MessageCircleIcon
            data-icon="inline-start"
            aria-hidden="true"
          />Message
        </Button>
      {/if}
      {#if onWave}
        <Button
          class="community-member-profile__action"
          variant="secondary"
          onclick={onWave}
        >
          <HandIcon data-icon="inline-start" aria-hidden="true" />Wave
        </Button>
      {/if}
      {#if onFollow}
        <Button
          class="community-member-profile__action"
          variant="secondary"
          onclick={onFollow}
        >
          <UserPlusIcon data-icon="inline-start" aria-hidden="true" />Follow
        </Button>
      {/if}
    </div>
  {/if}

  <section>
    <h3>About</h3>
    <p>
      {member.role ? `${member.role} in this community` : "Community member"}
    </p>
  </section>
</article>

<style>
  .community-member-profile {
    display: grid;
    gap: 1.5rem;
    padding: 1.25rem;
  }

  header {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 0.875rem;
  }

  header div,
  section {
    display: grid;
    gap: 0.25rem;
  }

  h2,
  h3,
  p {
    margin: 0;
  }

  h2 {
    font-size: var(--community-text-section);
  }

  :global(
      .community-member-profile__identity-copy[data-ui-component="button"]
    ) {
    height: auto;
    justify-content: flex-start;
    margin: -0.125rem -0.25rem;
    padding: 0.125rem 0.25rem;
    font-size: inherit;
    line-height: inherit;
  }

  h3 {
    font-size: var(--community-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  p {
    color: var(--muted-foreground);
    font-size: var(--community-text-body);
  }

  .community-member-profile__actions {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(5.5rem, 1fr));
    gap: 0.5rem;
  }

  :global(.community-member-profile__action[data-ui-component="button"]) {
    height: 4.25rem;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.5rem;
    transition:
      background-color 140ms ease,
      color 140ms ease,
      box-shadow 140ms ease;
    white-space: normal;
  }

  :global(
      .community-member-profile__action.community-member-profile__action:hover
    ),
  :global(
      .community-member-profile__action.community-member-profile__action:focus-visible
    ) {
    background: color-mix(in oklab, var(--primary) 14%, var(--secondary));
    color: var(--foreground);
    box-shadow: inset 0 0 0 1px
      color-mix(in oklab, var(--primary) 32%, transparent);
  }
</style>
