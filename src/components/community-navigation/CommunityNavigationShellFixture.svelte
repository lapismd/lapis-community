<script lang="ts">
  import { AppShell, AppShellController } from "@lapismd/design-core/shell";
  import { onMount } from "svelte";
  import type { CommunityController } from "../../community/index.js";
  import {
    createCommunityStoryRuntime,
    type CommunityStoryRuntime,
  } from "../../testing/index.js";
  import CommunityChannelSettings from "../community-channel-settings/CommunityChannelSettings.svelte";
  import CommunityInbox from "../community-inbox/CommunityInbox.svelte";
  import { communityInboxFixture } from "../community-inbox/story-fixtures.js";
  import CommunityNavigation from "./CommunityNavigation.svelte";
  import { communityNavigationFixture } from "./story-fixtures.js";
  import type {
    CommunityNavigationItemModel,
    CommunityNavigationModel,
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
  let runtime = $state<CommunityStoryRuntime>();
  let community = $state<CommunityController>();
  let runtimeError = $state("");
  let activeDestination = $state("");
  const workspace = $derived(community?.state.workspace);
  const inbox = $derived(community?.state.inbox ?? communityInboxFixture);
  const navigationModel = $derived.by<CommunityNavigationModel>(() => ({
    ...communityNavigationFixture,
    sections:
      workspace?.navigationSections.map((section) => {
        const fixture = communityNavigationFixture.sections.find(
          (candidate) => candidate.id === section.id,
        );
        return {
          id: section.id,
          label: section.label,
          ...(fixture?.primaryAction === undefined
            ? {}
            : { primaryAction: fixture.primaryAction }),
          ...(fixture?.actions === undefined
            ? {}
            : { actions: fixture.actions }),
          ...(fixture?.sortable === undefined
            ? {}
            : { sortable: fixture.sortable }),
          items: section.rooms.map(
            (room): CommunityNavigationItemModel => ({
              id: room.id,
              label: room.name,
              kind: room.kind === "direct" ? "direct-message" : room.kind,
              ...(room.private === undefined
                ? {}
                : { restricted: room.private }),
              ...(room.mentionCount === undefined &&
              room.unreadCount === undefined
                ? {}
                : { unreadCount: room.mentionCount ?? room.unreadCount }),
            }),
          ),
        };
      }) ?? communityNavigationFixture.sections,
  }));
  const activeItemId = $derived(
    activeDestination === "inbox" || activeDestination === "registry"
      ? activeDestination
      : (workspace?.activeRoomId ?? activeDestination),
  );

  $effect(() => {
    activeDestination = initialActiveItemId;
  });

  onMount(() => {
    let active = true;
    void createCommunityStoryRuntime()
      .then((created) => {
        if (!active) {
          created.dispose();
          return;
        }
        runtime = created;
        community = created.controller;
        community.initialize();
        void created.scenario.member.getPublicKey().then((pubkey) => {
          if (active) community?.actions.openDirectMessage([pubkey]);
        });
      })
      .catch((cause: unknown) => {
        if (active) {
          runtimeError =
            cause instanceof Error
              ? cause.message
              : "Community story runtime failed";
        }
      });
    return () => {
      active = false;
      runtime?.dispose();
    };
  });

  function select(item: CommunityNavigationItemModel): void {
    const room = workspace?.navigationSections
      .flatMap((section) => section.rooms)
      .find((candidate) => candidate.id === item.id);
    if (room) {
      activeDestination = room.id;
      community?.actions.selectRoom(room.id);
    } else {
      activeDestination = item.id;
    }
    onSelect(item);
  }
</script>

{#if runtimeError}
  <div class="lc-community-shell-frame__unavailable" role="status">
    {runtimeError}
  </div>
{/if}

<div
  class="lc-community-shell-frame"
  data-testid="community-navigation-runtime"
  data-community-status={community?.state.status ?? "loading"}
  data-community-backend={runtime?.backend ?? "loading"}
>
  <AppShell.Root
    {controller}
    displayMode="desktop"
    desktopMinMainWidth={0}
    class="lc-community-shell-surface"
  >
    <AppShell.Sidebar side="left">
      <CommunityNavigation
        model={navigationModel}
        {activeItemId}
        compact={controller.left.collapsed}
        onSelect={select}
        onSearch={(query) => {
          void community?.actions.search(query);
          onSearch(query);
        }}
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
        model={inbox}
        onSend={(content) =>
          community?.handlers.onSendReply?.(inbox.activeItemId, content)}
        onMarkAllRead={() => void community?.actions.markAllRead()}
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
