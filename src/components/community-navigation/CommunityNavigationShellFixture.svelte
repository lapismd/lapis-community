<script lang="ts">
  import { AppShell, AppShellController } from "@lapismd/design-core/shell";
  import CommunityChannelSettings from "../community-channel-settings/CommunityChannelSettings.svelte";
  import CommunityInbox from "../community-inbox/CommunityInbox.svelte";
  import { communityInboxFixture } from "../community-inbox/story-fixtures.js";
  import CommunityNavigation from "./CommunityNavigation.svelte";
  import { communityNavigationFixture } from "./story-fixtures.js";
  import type {
    CommunityNavigationItemModel,
    CommunityNavigationSectionActionModel,
    CommunityNavigationSectionModel,
  } from "./model.js";

  let {
    initialActiveItemId = "inbox",
    onSelect = () => {},
    onSearch = () => {},
    onSectionAction = () => {},
  }: {
    initialActiveItemId?: string;
    onSelect?: (item: CommunityNavigationItemModel) => void;
    onSearch?: (query: string) => void;
    onSectionAction?: (
      section: CommunityNavigationSectionModel,
      action: CommunityNavigationSectionActionModel,
    ) => void;
  } = $props();

  const controller = new AppShellController({
    rightClosed: true,
    rightWidth: 320,
  });
  let activeItemId = $state("");

  $effect(() => {
    activeItemId = initialActiveItemId;
  });

  function select(item: CommunityNavigationItemModel): void {
    activeItemId = item.id;
    onSelect(item);
  }
</script>

<div class="lc-community-shell-frame">
  <AppShell.Root
    {controller}
    displayMode="desktop"
    desktopMinMainWidth={0}
    class="lc-community-shell-surface"
  >
    <AppShell.Sidebar side="left">
      <CommunityNavigation
        model={communityNavigationFixture}
        {activeItemId}
        compact={controller.left.collapsed}
        onSelect={select}
        {onSearch}
        {onSectionAction}
        onRequestExpand={() => controller.left.expand()}
      >
        {#snippet headerEnd()}
          <AppShell.Sidebar.Toggle side="left" />
        {/snippet}
      </CommunityNavigation>
    </AppShell.Sidebar>

    <AppShell.Main>
      <CommunityInbox
        model={communityInboxFixture}
        onOpenChannelSettings={() => controller.right.open()}
      />
    </AppShell.Main>

    <AppShell.Sidebar side="right" label="Channel settings" closeable>
      <CommunityChannelSettings
        room={{
          ...communityInboxFixture.room,
          private: true,
          memberCount:
            communityInboxFixture.participantCount ??
            communityInboxFixture.members.length,
        }}
        members={communityInboxFixture.members}
        description="This private channel is your home base for getting oriented. Fizz, Honey, and Pollen can help you learn the app, troubleshoot setup, and work through something you are building."
      />
    </AppShell.Sidebar>
  </AppShell.Root>
</div>

<style>
  :global(#storybook-root:has(.lc-community-shell-frame)) {
    height: 100vh;
  }

  .lc-community-shell-frame {
    box-sizing: border-box;
    height: 100%;
    min-width: 48rem;
    padding: 1.5rem;
    background: var(--muted);
  }

  .lc-community-shell-frame:not(:global(#storybook-root *)) {
    height: 40rem;
  }

  :global(.lc-community-shell-surface) {
    --ui-shell-height: 100%;
    --ui-shell-right-sidebar-gap: 0;

    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: 0 1rem 2.5rem
      color-mix(in srgb, var(--foreground) 10%, transparent);
  }

  :global(
      .lc-community-shell-surface:has(
          > .ui-minimal-app-shell__composition
            > .ui-minimal-app-shell__sidebar[data-side="right"][data-presentation="inline"]:not(
              [hidden]
            )
        )
        > .ui-minimal-app-shell__composition
        > .ui-minimal-app-shell__main
    ) {
    border-start-end-radius: 0;
    border-end-end-radius: 0;
  }

  :global(
      .lc-community-shell-surface
        > .ui-minimal-app-shell__composition
        > .ui-minimal-app-shell__sidebar[data-side="right"][data-presentation="inline"]
    ) {
    margin-block: var(--ui-shell-main-block-inset);
    margin-inline-end: var(--ui-shell-main-block-inset);
    border: var(--ui-shell-main-border);
    border-inline-start: 0;
    border-start-end-radius: var(--ui-shell-main-radius);
    border-end-end-radius: var(--ui-shell-main-radius);
    background: var(--background);
    box-shadow: var(--ui-shell-main-shadow);
  }
</style>
