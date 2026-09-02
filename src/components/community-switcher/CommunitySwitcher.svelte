<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";

  import type { CommunityModel } from "../community-workspace/model.js";

  let {
    communities,
    activeCommunityId,
    compact = false,
    onSelect,
  }: {
    communities: CommunityModel[];
    activeCommunityId: string;
    compact?: boolean;
    onSelect?: (communityId: string) => void;
  } = $props();
</script>

<nav
  class="community-switcher"
  class:community-switcher--compact={compact}
  aria-label="Communities"
>
  {#each communities as community (community.id)}
    <Button
      type="button"
      variant="ghost"
      size={compact ? "icon" : "default"}
      class="community-switcher__item"
      data-active={community.id === activeCommunityId ? "true" : undefined}
      aria-label={compact ? `Open ${community.name}` : undefined}
      aria-current={community.id === activeCommunityId ? "page" : undefined}
      title={compact ? community.name : undefined}
      onclick={() => onSelect?.(community.id)}
    >
      <span class="community-switcher__initials" aria-hidden="true"
        >{community.initials}</span
      >
      {#if !compact}
        <span class="community-switcher__copy">
          <strong>{community.name}</strong>
          <small>{community.description ?? "Community workspace"}</small>
        </span>
      {/if}
      {#if community.unreadCount}
        <span
          class="community-switcher__unread"
          aria-label={`${community.unreadCount} unread`}
          >{community.unreadCount}</span
        >
      {/if}
    </Button>
  {/each}
  <Button
    type="button"
    variant="outline"
    size={compact ? "icon" : "default"}
    class="community-switcher__item community-switcher__add"
    aria-label={compact ? "Discover communities" : undefined}
  >
    <span class="community-switcher__initials" aria-hidden="true">+</span>
    {#if !compact}<span>Discover communities</span>{/if}
  </Button>
</nav>

<style>
  .community-switcher {
    display: flex;
    min-height: 100%;
    flex-direction: column;
    gap: 0.55rem;
    padding: 0.75rem 0.65rem;
  }

  .community-switcher__initials {
    display: grid;
    width: 2.5rem;
    height: 2.5rem;
    flex: none;
    place-items: center;
    border-radius: 0.75rem;
    color: var(--primary-foreground);
    background: var(--primary);
    font-size: 0.72rem;
    font-weight: 750;
  }

  :global(.community-switcher__item[data-ui-component="button"]) {
    position: relative;
    display: flex;
    width: 100%;
    min-width: 0;
    height: auto;
    min-height: 3rem;
    justify-content: flex-start;
    gap: 0.65rem;
    padding: 0.25rem;
    color: var(--sidebar-foreground, var(--foreground));
  }

  :global(
      .community-switcher__item[data-ui-component="button"][data-active="true"]
    ) {
    background: var(--sidebar-accent, var(--accent));
  }

  .community-switcher__copy {
    display: grid;
    min-width: 0;
    text-align: start;
  }

  .community-switcher__copy strong,
  .community-switcher__copy small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .community-switcher__copy small {
    color: var(--muted-foreground);
    font-size: 0.68rem;
    font-weight: 400;
  }

  .community-switcher__unread {
    min-width: 1.1rem;
    margin-inline-start: auto;
    border-radius: 999px;
    padding: 0 0.25rem;
    color: var(--destructive-foreground, white);
    background: var(--destructive);
    font-size: 0.65rem;
    line-height: 1.1rem;
    text-align: center;
  }

  .community-switcher--compact {
    align-items: center;
    padding-inline: 0.35rem;
  }

  :global(
      .community-switcher--compact
        .community-switcher__item[data-ui-component="button"]
    ) {
    width: 2.75rem;
    min-height: 2.75rem;
    justify-content: center;
    padding: 0;
  }

  .community-switcher--compact .community-switcher__unread {
    position: absolute;
    inset-block-start: -0.25rem;
    inset-inline-end: -0.25rem;
    margin: 0;
    border: 2px solid var(--sidebar, var(--background));
  }

  .community-switcher--compact .community-switcher__initials {
    width: 2.25rem;
    height: 2.25rem;
  }

  :global(
      .community-switcher--compact
        .community-switcher__item[data-ui-component="button"][data-active="true"]::before
    ) {
    position: absolute;
    inset-block: 0.55rem;
    inset-inline-start: -0.35rem;
    width: 0.16rem;
    border-radius: 999px;
    background: var(--sidebar-foreground, var(--foreground));
    content: "";
  }
</style>
