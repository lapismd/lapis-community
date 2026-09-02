<script lang="ts">
  import { onMount } from "svelte";

  import {
    createRegistryCommunityStoryRuntime,
    type RegistryCommunityStoryRuntime,
  } from "../../testing/index.js";
  import RegistryCommunity from "./RegistryCommunity.svelte";

  let runtime = $state<RegistryCommunityStoryRuntime>();
  let runtimeError = $state("");

  onMount(() => {
    let active = true;
    void createRegistryCommunityStoryRuntime()
      .then((created) => {
        if (!active) {
          created.dispose();
          return;
        }
        runtime = created;
      })
      .catch((cause: unknown) => {
        if (active) {
          runtimeError =
            cause instanceof Error
              ? cause.message
              : "Registry community story runtime failed";
        }
      });
    return () => {
      active = false;
      runtime?.dispose();
    };
  });
</script>

{#if runtimeError}
  <div class="registry-story__unavailable" role="status">{runtimeError}</div>
{:else if runtime}
  <div
    class="registry-story"
    data-testid="registry-community-runtime"
    data-community-backend={runtime.backend}
  >
    <RegistryCommunity
      plugin={runtime.scenario.plugin}
      name={runtime.scenario.name}
      version={runtime.scenario.version}
      publisher={runtime.scenario.publisher}
      relays={JSON.stringify([runtime.scenario.relayUrl])}
      dataSource={runtime.dataSource}
      identity={runtime.scenario.identity}
    />
  </div>
{:else}
  <p role="status">Preparing signed registry events…</p>
{/if}

<style>
  .registry-story {
    max-width: 76rem;
    margin: 0 auto;
  }

  .registry-story__unavailable {
    padding: 1rem;
    border: 1px solid var(--destructive);
    border-radius: var(--radius);
    color: var(--destructive);
  }
</style>
