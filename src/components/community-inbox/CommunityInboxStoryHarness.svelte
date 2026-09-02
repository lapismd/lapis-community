<script lang="ts">
  import { AppShell, AppShellController } from "@lapismd/design-core/shell";
  import { onMount } from "svelte";
  import type { CommunityController } from "../../community/index.js";
  import {
    createCommunityStoryRuntime,
    type CommunityStoryRuntime,
  } from "../../testing/index.js";
  import CommunityInbox from "./CommunityInbox.svelte";
  import { communityInboxFixture } from "./story-fixtures.js";

  let runtime = $state<CommunityStoryRuntime>();
  let community = $state<CommunityController>();
  let runtimeError = $state("");
  const model = $derived(community?.state.inbox ?? communityInboxFixture);
  const controller = new AppShellController();

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

  function send(content: string): void {
    community?.handlers.onSendReply?.(model.activeItemId, content);
  }
</script>

{#if runtimeError}
  <div class="community-inbox-story-harness__unavailable" role="status">
    {runtimeError}
  </div>
{/if}

<div
  class="community-inbox-story-harness"
  data-testid="community-inbox-runtime"
  data-community-status={community?.state.status ?? "loading"}
  data-community-backend={runtime?.backend ?? "loading"}
>
  <AppShell.Root {controller} displayMode="desktop" desktopMinMainWidth={0}>
    <AppShell.Main>
      <CommunityInbox
        {model}
        onSend={send}
        onMarkAllRead={() => void community?.actions.markAllRead()}
      />
    </AppShell.Main>
  </AppShell.Root>
</div>

<style>
  .community-inbox-story-harness {
    height: min(46rem, 100vh);
  }

  .community-inbox-story-harness :global([data-shell-root]) {
    --ui-shell-height: 100%;
  }
</style>
