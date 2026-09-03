<script lang="ts">
  import { Badge } from "@lapismd/design-core/shadcn/badge";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as DropdownMenu from "@lapismd/design-core/shadcn/dropdown-menu";
  import LogInIcon from "@lucide/svelte/icons/log-in";
  import LogOutIcon from "@lucide/svelte/icons/log-out";
  import SmileIcon from "@lucide/svelte/icons/smile";

  import type { CommunityConnectionStatus } from "../../community/index.js";
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import type { CommunityMemberModel } from "../community-workspace/model.js";
  import type { CommunityProfileMenuAction } from "./model.js";

  let {
    member,
    communityName,
    compact = false,
    authenticated = true,
    canManageCommunity = false,
    canSendFeedback = false,
    connectionStatus = "connected",
    onAction = () => {},
  }: {
    member: CommunityMemberModel;
    communityName: string;
    compact?: boolean;
    authenticated?: boolean;
    canManageCommunity?: boolean;
    canSendFeedback?: boolean;
    connectionStatus?: CommunityConnectionStatus;
    onAction?: (action: CommunityProfileMenuAction) => void;
  } = $props();

  const presence = $derived(member.presence ?? "offline");
  const presenceLabel = $derived(
    presence === "online" ? "Online" : presence === "away" ? "Away" : "Offline",
  );
  const connectionLabel = $derived(
    connectionStatus === "connecting"
      ? "Connecting to relay…"
      : connectionStatus === "error" || connectionStatus === "offline"
        ? "Reconnecting to relay…"
        : "",
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
          <CommunityMemberAvatar {member} showPresence decorative />
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
        <CommunityMemberAvatar {member} showPresence decorative />
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

      {#if authenticated}
        <DropdownMenu.Item
          class="community-profile-menu__status-action"
          onSelect={() => onAction("update-status")}
        >
          <SmileIcon data-icon="inline-start" aria-hidden="true" />
          <span>Update your status</span>
        </DropdownMenu.Item>

        <DropdownMenu.Separator />
      {:else}
        <DropdownMenu.Item onSelect={() => onAction("sign-in")}>
          <LogInIcon data-icon="inline-start" aria-hidden="true" />
          <span>Sign in</span>
        </DropdownMenu.Item>

        <DropdownMenu.Separator />
      {/if}

      <DropdownMenu.Sub>
        <DropdownMenu.SubTrigger>
          <span
            class="community-profile-menu__community-icon"
            aria-hidden="true">🐝</span
          >
          <span class="community-profile-menu__community-label">
            <span>{communityName}</span>
            {#if connectionLabel}<small>{connectionLabel}</small>{/if}
          </span>
        </DropdownMenu.SubTrigger>
        <DropdownMenu.SubContent>
          <DropdownMenu.Item onSelect={() => onAction("community-settings")}>
            Community settings
          </DropdownMenu.Item>
          {#if authenticated && canManageCommunity}
            <DropdownMenu.Item onSelect={() => onAction("manage-members")}
              >Manage members</DropdownMenu.Item
            >
          {/if}
        </DropdownMenu.SubContent>
      </DropdownMenu.Sub>

      <DropdownMenu.Separator />

      {#if canSendFeedback}
        <DropdownMenu.Item onSelect={() => onAction("send-feedback")}
          >Send feedback</DropdownMenu.Item
        >
      {/if}
      {#if authenticated}
        <DropdownMenu.Item onSelect={() => onAction("settings")}>
          Settings
          <DropdownMenu.Shortcut>⌘,</DropdownMenu.Shortcut>
        </DropdownMenu.Item>
        <DropdownMenu.Item onSelect={() => onAction("sign-out")}>
          <LogOutIcon data-icon="inline-start" aria-hidden="true" />
          Sign out
        </DropdownMenu.Item>
      {/if}
    </DropdownMenu.Content>
  </DropdownMenu.Root>
</div>

<style>
  .community-profile-menu {
    --community-member-avatar-presence-ring: var(--sidebar, var(--background));

    padding: 0.5rem 0.75rem 0.75rem;
  }

  .community-profile-menu[data-compact] {
    padding-inline: 0.5rem;
  }

  :global(.community-profile-menu__trigger[data-ui-component="button"]) {
    width: 100%;
    min-width: 0;
    height: auto;
    min-height: 3rem;
    justify-content: flex-start;
    gap: 0.75rem;
    padding: 0.375rem 0.5rem;
    border-radius: 0.75rem;
    color: var(--sidebar-foreground, var(--foreground));
    transition:
      color 120ms ease,
      background-color 120ms ease,
      box-shadow 120ms ease;
  }

  :global(.community-profile-menu__trigger[data-ui-component="button"]:hover),
  :global(
      .community-profile-menu__trigger[data-ui-component="button"]:focus-visible
    ),
  :global(
      .community-profile-menu__trigger[data-ui-component="button"][data-state="open"]
    ) {
    color: var(--sidebar-accent-foreground, var(--foreground));
    background: color-mix(
      in srgb,
      var(--sidebar-accent, var(--accent)) 88%,
      transparent
    );
    box-shadow: inset 0 0 0 1px
      color-mix(in srgb, var(--foreground) 7%, transparent);
  }

  :global(
      .community-profile-menu[data-compact]
        .community-profile-menu__trigger[data-ui-component="button"]
    ) {
    width: 2.5rem;
    min-height: 2.5rem;
    justify-content: center;
    margin-inline: auto;
    padding: 0;
  }

  .community-profile-menu__identity,
  .community-profile-menu__menu-identity {
    display: grid;
    min-width: 0;
    text-align: start;
  }

  .community-profile-menu__identity {
    gap: 0.125rem;
  }

  .community-profile-menu__identity strong,
  .community-profile-menu__identity small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .community-profile-menu__identity strong {
    font-size: 0.9375rem;
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

  :global(.community-profile-menu__community-label) {
    display: grid;
    min-width: 0;
    flex: 1;
  }

  :global(.community-profile-menu__community-label small) {
    overflow: hidden;
    color: var(--muted-foreground);
    font-size: 0.68rem;
    font-weight: 400;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
