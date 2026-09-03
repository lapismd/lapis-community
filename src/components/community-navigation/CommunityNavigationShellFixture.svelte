<script lang="ts">
  import { AppShell, AppShellController } from "@lapismd/design-core/shell";
  import { onMount, untrack } from "svelte";
  import type { CommunityController } from "../../community/index.js";
  import {
    createCommunityStoryRuntime,
    type CommunityStoryRuntime,
  } from "../../testing/index.js";
  import CommunityAppShell from "../community-app-shell/CommunityAppShell.svelte";
  import CommunityChannelSettings from "../community-channel-settings/CommunityChannelSettings.svelte";
  import CommunityInbox from "../community-inbox/CommunityInbox.svelte";
  import { communityInboxFixture } from "../community-inbox/story-fixtures.js";
  import CommunityProfileMenu from "../community-profile-menu/CommunityProfileMenu.svelte";
  import CommunitySettingsNavigation from "../community-settings-navigation/CommunitySettingsNavigation.svelte";
  import CommunitySettings from "../community-settings/CommunitySettings.svelte";
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
  let activeDestination = $state(untrack(() => initialActiveItemId));
  let settingsSection = $state<"profile" | "custom-emoji">("profile");
  let navigationHistory = $state<string[]>(
    untrack(() => [initialActiveItemId]),
  );
  let navigationHistoryIndex = $state(0);
  const workspace = $derived(community?.state.workspace);
  const currentMember = $derived(
    workspace?.currentMemberId
      ? workspace.members.find(
          (member) => member.id === workspace.currentMemberId,
        )
      : undefined,
  );
  const activeCommunity = $derived(
    workspace?.communities.find(
      (candidate) => candidate.id === workspace.activeCommunityId,
    ),
  );
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
  const canNavigateBack = $derived(navigationHistoryIndex > 0);
  const canNavigateForward = $derived(
    navigationHistoryIndex < navigationHistory.length - 1,
  );
  const emojiOperation = $derived.by(() =>
    Object.entries(community?.state.operations ?? {})
      .filter(([key]) => key.startsWith("settings:emoji:"))
      .map(([, operation]) => operation)
      .find((operation) => operation.status !== "idle"),
  );

  onMount(() => {
    let active = true;
    let runtimeGeneration = 0;
    const startRuntime = (): void => {
      const currentGeneration = ++runtimeGeneration;
      runtime?.dispose();
      runtime = undefined;
      community = undefined;
      runtimeError = "";
      void createCommunityStoryRuntime()
        .then((created) => {
          if (!active || currentGeneration !== runtimeGeneration) {
            created.dispose();
            return;
          }
          runtime = created;
          community = created.controller;
          community.initialize();
          if (created.backend !== "live") {
            void created.scenario.member.getPublicKey().then((pubkey) => {
              if (active && currentGeneration === runtimeGeneration) {
                community?.actions.openDirectMessage([pubkey]);
              }
            });
          }
        })
        .catch((cause: unknown) => {
          if (active && currentGeneration === runtimeGeneration) {
            runtimeError =
              cause instanceof Error
                ? cause.message
                : "Community story runtime failed";
          }
        });
    };
    window.addEventListener("community-story-backend-change", startRuntime);
    startRuntime();
    return () => {
      active = false;
      runtimeGeneration += 1;
      window.removeEventListener(
        "community-story-backend-change",
        startRuntime,
      );
      runtime?.dispose();
    };
  });

  function activate(
    item: CommunityNavigationItemModel,
    recordHistory: boolean,
  ): void {
    if (recordHistory && item.id !== activeDestination) {
      const nextHistory = [
        ...navigationHistory.slice(0, navigationHistoryIndex + 1),
        item.id,
      ];
      navigationHistory = nextHistory;
      navigationHistoryIndex = nextHistory.length - 1;
    }
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

  function select(item: CommunityNavigationItemModel): void {
    activate(item, true);
  }

  function openSettings(recordHistory = true): void {
    if (recordHistory && activeDestination !== "settings") {
      navigationHistory = [
        ...navigationHistory.slice(0, navigationHistoryIndex + 1),
        "settings",
      ];
      navigationHistoryIndex = navigationHistory.length - 1;
    }
    activeDestination = "settings";
    controller.left.expand();
    controller.right.close();
  }

  function closeSettings(): void {
    const inboxItem = itemFor("inbox");
    if (inboxItem) activate(inboxItem, true);
  }

  function itemFor(destinationId: string): CommunityNavigationItemModel | null {
    return (
      [
        ...navigationModel.primaryItems,
        ...navigationModel.sections.flatMap((section) => section.items),
      ].find((item) => item.id === destinationId) ?? null
    );
  }

  function navigateHistory(offset: -1 | 1): void {
    const nextIndex = navigationHistoryIndex + offset;
    const destinationId = navigationHistory[nextIndex];
    if (destinationId === undefined) return;
    if (destinationId === "settings") {
      navigationHistoryIndex = nextIndex;
      openSettings(false);
      return;
    }
    const item = itemFor(destinationId);
    if (!item) return;
    navigationHistoryIndex = nextIndex;
    activate(item, false);
  }
</script>

{#if runtimeError}
  <div class="lc-community-shell-frame__unavailable" role="status">
    {runtimeError}
  </div>
{/if}

<CommunityAppShell
  {controller}
  displayMode="desktop"
  desktopMinMainWidth={0}
  {canNavigateBack}
  {canNavigateForward}
  onNavigateBack={() => navigateHistory(-1)}
  onNavigateForward={() => navigateHistory(1)}
  data-testid="community-navigation-runtime"
  data-community-status={community?.state.status ?? "loading"}
  data-community-backend={runtime?.backend ?? "loading"}
>
  <AppShell.Sidebar side="left">
    {#if activeDestination === "settings"}
      <CommunitySettingsNavigation
        section={settingsSection}
        onSelect={(value) => (settingsSection = value)}
        onClose={closeSettings}
      />
    {:else}
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
        {#snippet footer()}
          {#if currentMember}
            <CommunityProfileMenu
              member={{
                ...currentMember,
                presence:
                  community?.state.status === "connected"
                    ? "online"
                    : "offline",
              }}
              communityName={activeCommunity?.name ?? "Lapis Community"}
              compact={controller.left.collapsed}
              canManageCommunity={community?.state.capabilities.manageMembers ??
                false}
              onAction={(action) => {
                if (action === "settings") openSettings();
              }}
            />
          {/if}
        {/snippet}
      </CommunityNavigation>
    {/if}
  </AppShell.Sidebar>

  <AppShell.Main>
    {#if activeDestination === "settings" && community}
      <AppShell.Body layout="regions" label="Personal settings">
        <AppShell.Body.Content>
          <CommunitySettings
            model={community.state.settings}
            section={settingsSection}
            {...community.state.operations["settings:profile"] === undefined
              ? {}
              : {
                  profileOperation:
                    community.state.operations["settings:profile"],
                }}
            {...emojiOperation === undefined ? {} : { emojiOperation }}
            onUpdateProfile={(profile) =>
              community!.actions.updateProfile(profile)}
            onAddCustomEmoji={(shortcode, url) =>
              community!.actions.setCustomEmoji(shortcode, url)}
            onRemoveCustomEmoji={(shortcode) =>
              community!.actions.removeCustomEmoji(shortcode)}
          />
        </AppShell.Body.Content>
      </AppShell.Body>
    {:else}
      <CommunityInbox
        model={inbox}
        onSend={(content) =>
          community?.handlers.onSendReply?.(inbox.activeItemId, content)}
        onMarkAllRead={() => void community?.actions.markAllRead()}
        onOpenChannelSettings={() => controller.right.open()}
      />
    {/if}
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
</CommunityAppShell>
