<script lang="ts">
  import { onMount } from "svelte";

  import {
    createRegistryCommunityStoryRuntime,
    type RegistryCommunityStoryRuntime,
  } from "../../testing/index.js";
  import RegistryCommunity from "./RegistryCommunity.svelte";

  let {
    namespace = "stable-timeline",
    countMode = "exact",
    countLatencyMs = 0,
    latencyMs = 75,
    postCount = 260,
    postsPerSecond = 1,
  }: {
    namespace?: string;
    countMode?: "exact" | "approximate" | "unavailable";
    countLatencyMs?: number;
    latencyMs?: number;
    postCount?: number;
    postsPerSecond?: number;
  } = $props();

  let runtime = $state<RegistryCommunityStoryRuntime>();
  let runtimeError = $state("");

  onMount(() => {
    let active = true;
    void createRegistryCommunityStoryRuntime({
      ...(countMode === "exact" ? {} : { backend: "memory" as const }),
      postCount,
      postsPerSecond,
      latencyMs,
      includeReleaseEvents: false,
      namespace,
      countMode,
      countLatencyMs,
    })
      .then((created) => {
        if (active) runtime = created;
        else created.dispose();
      })
      .catch((cause: unknown) => {
        if (active)
          runtimeError =
            cause instanceof Error ? cause.message : "Timeline fixture failed";
      });
    return () => {
      active = false;
      runtime?.dispose();
    };
  });
</script>

{#if runtimeError}
  <p role="alert">{runtimeError}</p>
{:else if runtime}
  <div
    class="long-timeline-story"
    data-testid="long-timeline-runtime"
    data-community-backend={runtime.backend}
    data-count-mode={countMode}
  >
    <RegistryCommunity
      plugin={runtime.scenario.plugin}
      name={runtime.scenario.name}
      version={runtime.scenario.version}
      publisher={runtime.scenario.publisher}
      relays={JSON.stringify([runtime.scenario.relayUrl])}
      dataSource={runtime.dataSource}
      {...runtime.identity === undefined ? {} : { identity: runtime.identity }}
    />
  </div>
{:else}
  <p role="status">Preparing {postCount} signed discussion posts…</p>
{/if}

<style>
  .long-timeline-story {
    width: min(100%, 76rem);
    min-height: 58rem;
    margin-inline: auto;
  }
</style>
