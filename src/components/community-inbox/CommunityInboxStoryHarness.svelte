<script lang="ts">
  import { AppShell, AppShellController } from "@lapismd/design-core/shell";
  import { onMount } from "svelte";
  import type { CommunityController } from "../../community/index.js";
  import {
    createCommunityStoryRuntime,
    type CommunityStoryRuntime,
  } from "../../testing/index.js";
  import CommunityAppShell from "../community-app-shell/CommunityAppShell.svelte";
  import CommunityInbox from "./CommunityInbox.svelte";
  import { communityInboxFixture } from "./story-fixtures.js";

  let {
    empty = false,
    historyUpdating = false,
    loading = false,
    conversationLoading = false,
  }: {
    empty?: boolean;
    historyUpdating?: boolean;
    loading?: boolean;
    conversationLoading?: boolean;
  } = $props();

  let runtime = $state<CommunityStoryRuntime>();
  let community = $state<CommunityController>();
  let runtimeError = $state("");
  const projectedModel = $derived(
    community?.state.inbox ?? communityInboxFixture,
  );
  const model = $derived(
    empty
      ? {
          ...projectedModel,
          activeItemId: "",
          threadTitle: "Inbox",
          participantCount: 0,
          items: [],
          messages: [],
        }
      : {
          ...projectedModel,
          activeItemId: projectedModel.activeItemId,
        },
  );
  const controller = new AppShellController();

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

  function send(content: string): void {
    void community?.actions.sendInboxMessage?.(content);
  }
</script>

{#if runtimeError}
  <div class="community-inbox-story-harness__unavailable" role="status">
    {runtimeError}
  </div>
{/if}

<CommunityAppShell
  {controller}
  displayMode="desktop"
  desktopMinMainWidth={0}
  data-testid="community-inbox-runtime"
  data-community-status={community?.state.status ?? "loading"}
  data-community-content-sync={community?.state.contentSync?.phase ?? "legacy"}
  data-community-backend={runtime?.backend ?? "loading"}
>
  <AppShell.Main>
    <CommunityInbox
      {model}
      {historyUpdating}
      {loading}
      {conversationLoading}
      onSelect={(itemId) => void community?.actions.selectInboxItem?.(itemId)}
      onFilterChange={(filter, unreadOnly) =>
        community?.actions.setInboxFilter?.(filter, unreadOnly)}
      onSend={send}
      onMarkAllRead={() => void community?.actions.markAllRead()}
      onOpenChannelSettings={() => controller.right.open()}
    />
  </AppShell.Main>
</CommunityAppShell>
