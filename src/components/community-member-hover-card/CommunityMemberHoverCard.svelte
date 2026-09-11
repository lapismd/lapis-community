<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as HoverCard from "@lapismd/design-core/shadcn/hover-card";
  import ActivityIcon from "@lucide/svelte/icons/activity";
  import HandIcon from "@lucide/svelte/icons/hand";
  import MessageCircleIcon from "@lucide/svelte/icons/message-circle";

  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import type { CommunityMemberModel } from "../community-workspace/model.js";

  let {
    member,
    onOpenProfile,
    onViewActivity,
    onMessage,
    onWave,
    openDelay = 280,
    trigger = "avatar",
    triggerLabel = `@${member.name}`,
    avatarSize = "medium",
  }: {
    member: CommunityMemberModel;
    onOpenProfile?: (member: CommunityMemberModel) => void;
    onViewActivity?: (member: CommunityMemberModel) => void;
    onMessage?: (member: CommunityMemberModel) => void;
    onWave?: (member: CommunityMemberModel) => void;
    openDelay?: number;
    trigger?: "avatar" | "mention";
    triggerLabel?: string;
    avatarSize?: "xsmall" | "small" | "medium";
  } = $props();

  let open = $state(false);
</script>

<HoverCard.Root bind:open {openDelay} closeDelay={120}>
  <HoverCard.Trigger>
    {#snippet child({ props })}
      {#if trigger === "mention"}
        <CommunityChip
          buttonProps={props}
          variant="muted"
          size="inline"
          ariaLabel={triggerLabel}
          onclick={() => onOpenProfile?.(member)}
        >
          <CommunityMemberAvatar {member} size="inline" decorative />
          <span>{triggerLabel}</span>
        </CommunityChip>
      {:else}
        <button
          {...props}
          type="button"
          class="community-member-hover-card__trigger"
          data-size={avatarSize}
          aria-label={`View ${member.name}'s profile`}
          onclick={() => onOpenProfile?.(member)}
        >
          <CommunityMemberAvatar {member} size={avatarSize} decorative />
        </button>
      {/if}
    {/snippet}
  </HoverCard.Trigger>

  <!-- Keep the content ref available before opening: LinkPreview installs its
       document selection listener only after that ref exists. -->
  <HoverCard.Content
    forceMount
    hidden={!open}
    side="right"
    align="start"
    sideOffset={8}
    class="community-member-hover-card__content"
    role="group"
    aria-label={`${member.name} contact preview`}
  >
    <button
      type="button"
      class="community-member-hover-card__identity"
      aria-label={`Open ${member.name}'s profile`}
      onclick={() => onOpenProfile?.(member)}
    >
      <CommunityMemberAvatar {member} size="large" showPresence decorative />
      <span>
        <strong>{member.name}</strong>
        <small>@{member.handle}</small>
      </span>
    </button>

    {#if member.role}
      <p class="community-member-hover-card__role">{member.role}</p>
    {/if}

    <div class="community-member-hover-card__actions">
      {#if onViewActivity}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`View activity log for ${member.name}`}
          onclick={() => onViewActivity?.(member)}
        >
          <ActivityIcon data-icon="inline-start" aria-hidden="true" />
          Activity log
        </Button>
      {/if}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={!onMessage}
        aria-label={`Message ${member.name}`}
        onclick={() => onMessage?.(member)}
      >
        <MessageCircleIcon data-icon="inline-start" aria-hidden="true" />
        Message
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={!onWave}
        aria-label={`Wave to ${member.name}`}
        onclick={() => onWave?.(member)}
      >
        <HandIcon data-icon="inline-start" aria-hidden="true" />
        Wave
      </Button>
    </div>
  </HoverCard.Content>
</HoverCard.Root>

<style>
  :global(.community-member-hover-card__content[hidden]) {
    display: none;
  }
  .community-member-hover-card__trigger {
    display: block;
    width: 2.25rem;
    height: 2.25rem;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
  }

  .community-member-hover-card__trigger[data-size="small"] {
    width: 2rem;
    height: 2rem;
  }

  .community-member-hover-card__trigger[data-size="xsmall"] {
    width: 1.5rem;
    height: 1.5rem;
  }

  :global(
      .community-member-hover-card__content[data-ui-component="hover-card"]
    ) {
    --ui-hover-card-radius: 0.85rem;

    display: grid;
    width: 15rem;
    gap: 0.625rem;
    padding: 0.625rem;
  }

  .community-member-hover-card__identity {
    display: grid;
    width: 100%;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 0.75rem;
    border: 0;
    border-radius: 0.65rem;
    background: transparent;
    padding: 0.375rem;
    color: inherit;
    text-align: start;
    cursor: pointer;
  }

  .community-member-hover-card__identity:hover,
  .community-member-hover-card__identity:focus-visible {
    background: color-mix(in oklab, var(--foreground) 7%, transparent);
    outline: none;
  }

  .community-member-hover-card__identity > span {
    display: grid;
    min-width: 0;
    gap: 0.125rem;
  }

  .community-member-hover-card__identity strong,
  .community-member-hover-card__identity small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .community-member-hover-card__identity strong {
    font-size: var(--community-text-body);
  }

  .community-member-hover-card__identity small,
  .community-member-hover-card__role {
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
  }

  .community-member-hover-card__role {
    margin: -0.125rem 0 0;
    padding-inline: 0.375rem;
    text-transform: capitalize;
  }

  .community-member-hover-card__actions {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(5.5rem, 1fr));
    gap: 0.25rem;
    border-block-start: 1px solid var(--border);
    padding-block-start: 0.5rem;
  }

  .community-member-hover-card__actions :global([data-ui-component="button"]) {
    justify-content: flex-start;
    padding-inline: 0.5rem;
    font-size: var(--community-text-secondary);
  }
</style>
