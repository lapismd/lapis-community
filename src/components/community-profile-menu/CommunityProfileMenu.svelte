<script lang="ts">
  import { Badge } from "@lapismd/design-core/shadcn/badge";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as DropdownMenu from "@lapismd/design-core/shadcn/dropdown-menu";
  import SmileIcon from "@lucide/svelte/icons/smile";

  import type { CommunityMemberModel } from "../community-workspace/model.js";
  import type { CommunityProfileMenuAction } from "./model.js";

  let {
    member,
    communityName,
    compact = false,
    canManageCommunity = false,
    onAction = () => {},
  }: {
    member: CommunityMemberModel;
    communityName: string;
    compact?: boolean;
    canManageCommunity?: boolean;
    onAction?: (action: CommunityProfileMenuAction) => void;
  } = $props();

  const presence = $derived(member.presence ?? "offline");
  const presenceLabel = $derived(
    presence === "online" ? "Online" : presence === "away" ? "Away" : "Offline",
  );
</script>

<div class="community-profile-menu" data-compact={compact || undefined}>
  <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <Button
          {...props}
          type="button"
          variant="ghost"
          class="community-profile-menu__trigger"
          aria-label={`Open profile menu for ${member.name}`}
          title={compact ? `Open profile menu for ${member.name}` : undefined}
        >
          <span class="community-profile-menu__avatar-wrap">
            {#if member.avatarUrl}
              <img
                class="community-profile-menu__avatar"
                src={member.avatarUrl}
                alt=""
              />
            {:else}
              <span
                class="community-profile-menu__avatar community-profile-menu__avatar--fallback"
                aria-hidden="true">{member.initials}</span
              >
            {/if}
            <span
              class="community-profile-menu__presence"
              data-presence={presence}
              aria-label={presenceLabel}
              role="img"
            ></span>
          </span>
          {#if !compact}
            <span class="community-profile-menu__identity">
              <strong>{member.name}</strong>
              <small><span aria-hidden="true">🐝</span> {communityName}</small>
            </span>
          {/if}
        </Button>
      {/snippet}
    </DropdownMenu.Trigger>

    <DropdownMenu.Content
      side="top"
      align="start"
      sideOffset={8}
      class="community-profile-menu__content"
      aria-label="Profile menu"
    >
      <DropdownMenu.Label class="community-profile-menu__menu-header">
        <span class="community-profile-menu__avatar-wrap">
          {#if member.avatarUrl}
            <img
              class="community-profile-menu__avatar"
              src={member.avatarUrl}
              alt={`${member.name} avatar`}
            />
          {:else}
            <span
              class="community-profile-menu__avatar community-profile-menu__avatar--fallback"
              aria-hidden="true">{member.initials}</span
            >
          {/if}
          <span
            class="community-profile-menu__presence"
            data-presence={presence}
            aria-hidden="true"
          ></span>
        </span>
        <span class="community-profile-menu__menu-identity">
          <strong>{member.name}</strong>
          <Badge
            variant="secondary"
            class="community-profile-menu__status"
            data-presence={presence}
          >
            {presenceLabel}
          </Badge>
        </span>
      </DropdownMenu.Label>

      <DropdownMenu.Item
        class="community-profile-menu__status-action"
        onSelect={() => onAction("update-status")}
      >
        <SmileIcon data-icon="inline-start" aria-hidden="true" />
        <span>Update your status</span>
      </DropdownMenu.Item>

      <DropdownMenu.Separator />

      <DropdownMenu.Sub>
        <DropdownMenu.SubTrigger>
          <span
            class="community-profile-menu__community-icon"
            aria-hidden="true">🐝</span
          >
          <span>{communityName}</span>
        </DropdownMenu.SubTrigger>
        <DropdownMenu.SubContent>
          <DropdownMenu.Item onSelect={() => onAction("community-profile")}>
            Community profile
          </DropdownMenu.Item>
          <DropdownMenu.Item
            disabled={!canManageCommunity}
            onSelect={() => onAction("manage-members")}
          >
            Manage members
          </DropdownMenu.Item>
        </DropdownMenu.SubContent>
      </DropdownMenu.Sub>

      <DropdownMenu.Separator />

      <DropdownMenu.Item onSelect={() => onAction("send-feedback")}>
        Send feedback
      </DropdownMenu.Item>
      <DropdownMenu.Item onSelect={() => onAction("settings")}>
        Settings
        <DropdownMenu.Shortcut>⌘,</DropdownMenu.Shortcut>
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Root>
</div>

<style>
  .community-profile-menu {
    padding: 0.5rem 0.75rem 0.75rem;
  }

  .community-profile-menu[data-compact] {
    padding-inline: 0.5rem;
  }

  :global(.community-profile-menu__trigger[data-ui-component="button"]) {
    width: 100%;
    min-width: 0;
    height: auto;
    min-height: 2.75rem;
    justify-content: flex-start;
    gap: 0.625rem;
    padding: 0.375rem;
    color: var(--sidebar-foreground, var(--foreground));
  }

  :global(
      .community-profile-menu[data-compact]
        .community-profile-menu__trigger[data-ui-component="button"]
    ) {
    width: 2rem;
    min-height: 2rem;
    justify-content: center;
    margin-inline: auto;
    padding: 0;
  }

  .community-profile-menu__avatar-wrap {
    position: relative;
    display: block;
    width: 2rem;
    height: 2rem;
    flex: none;
  }

  .community-profile-menu__avatar {
    display: grid;
    width: 100%;
    height: 100%;
    place-items: center;
    border-radius: 999px;
    object-fit: cover;
  }

  .community-profile-menu__avatar--fallback {
    color: var(--primary-foreground);
    background: var(--primary);
    font-size: 0.6875rem;
    font-weight: 700;
  }

  .community-profile-menu__presence {
    position: absolute;
    right: -0.125rem;
    bottom: -0.125rem;
    width: 0.625rem;
    height: 0.625rem;
    border: 2px solid var(--sidebar, var(--background));
    border-radius: 999px;
    background: var(--muted-foreground);
  }

  .community-profile-menu__presence[data-presence="online"] {
    background: var(--success, #08b94e);
  }

  .community-profile-menu__presence[data-presence="away"] {
    background: var(--warning, #d99a00);
  }

  .community-profile-menu__identity,
  .community-profile-menu__menu-identity {
    display: grid;
    min-width: 0;
    text-align: start;
  }

  .community-profile-menu__identity strong,
  .community-profile-menu__identity small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .community-profile-menu__identity strong {
    font-size: 0.875rem;
    line-height: 1.1;
  }

  .community-profile-menu__identity small {
    color: var(--muted-foreground);
    font-size: 0.75rem;
  }

  :global(.community-profile-menu__content) {
    width: min(18rem, calc(100vw - 1rem));
    border-radius: 1rem;
    padding: 0.5rem;
  }

  :global(.community-profile-menu__menu-header) {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.375rem 0.5rem 0.75rem;
  }

  :global(.community-profile-menu__menu-identity) {
    gap: 0.25rem;
    justify-items: start;
  }

  :global(.community-profile-menu__menu-identity strong) {
    color: var(--foreground);
    font-size: 0.9375rem;
  }

  :global(.community-profile-menu__status-action) {
    min-height: 2.75rem;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
  }

  :global(.community-profile-menu__status[data-ui-component="badge"]) {
    border: 0;
    color: var(--muted-foreground);
    background: color-mix(in srgb, var(--muted-foreground) 12%, transparent);
  }

  :global(
      .community-profile-menu__status[data-ui-component="badge"][data-presence="online"]
    ) {
    color: color-mix(in srgb, var(--success, #08b94e) 82%, var(--foreground));
    background: color-mix(in srgb, var(--success, #08b94e) 16%, transparent);
  }

  :global(
      .community-profile-menu__status[data-ui-component="badge"][data-presence="away"]
    ) {
    color: color-mix(in srgb, var(--warning, #d99a00) 76%, var(--foreground));
    background: color-mix(in srgb, var(--warning, #d99a00) 16%, transparent);
  }

  :global(.community-profile-menu__community-icon) {
    width: 1rem;
    text-align: center;
  }
</style>
