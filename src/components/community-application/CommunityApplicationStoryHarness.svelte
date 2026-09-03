<script lang="ts">
  import { onMount } from "svelte";

  import {
    createBrowserCommunityConfigurationStore,
    type CommunityController,
  } from "../../community/index.js";
  import {
    createCommunityStoryRuntime,
    type CommunityStoryRuntime,
  } from "../../testing/index.js";
  import RegistryCommunityStoryHarness from "../registry-community/RegistryCommunityStoryHarness.svelte";
  import { createRegistryStoryDataSource } from "../registry-browser/story-fixtures.js";
  import CommunityApplication from "./CommunityApplication.svelte";

  let runtime = $state<CommunityStoryRuntime>();
  let community = $state<CommunityController>();
  let runtimeError = $state("");
  const registrySource = createRegistryStoryDataSource();

  onMount(() => {
    let active = true;
    let runtimeGeneration = 0;
    const startRuntime = (): void => {
      const currentGeneration = ++runtimeGeneration;
      runtime?.dispose();
      runtime = undefined;
      community = undefined;
      runtimeError = "";
      const selectedBackend =
        document.documentElement.dataset.communityBackend ?? "memory";
      const configurationStore =
        selectedBackend === "live"
          ? createBrowserCommunityConfigurationStore({
              prefix: "lapismd.community.story.live.v1",
            })
          : undefined;
      void createCommunityStoryRuntime({
        ...(configurationStore === undefined ? {} : { configurationStore }),
      })
        .then(async (created) => {
          if (!active || currentGeneration !== runtimeGeneration) {
            created.dispose();
            return;
          }
          runtime = created;
          community = created.controller;
          community.initialize();
          if (created.backend !== "live") {
            const memberPubkey = await created.scenario.member.getPublicKey();
            if (!active || currentGeneration !== runtimeGeneration) return;
            community.actions.openDirectMessage([memberPubkey]);
            community.actions.selectRoom("general");
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
</script>

{#if runtimeError}
  <div class="community-application-story__unavailable" role="status">
    {runtimeError}
  </div>
{:else if community && runtime}
  {#snippet registryDiscussion()}
    <div class="community-application-story__registry-discussion">
      <RegistryCommunityStoryHarness />
    </div>
  {/snippet}
  <CommunityApplication
    controller={community}
    displayMode="desktop"
    data-testid="full-community-application"
    data-community-backend={runtime.backend}
    registryOptions={{
      source: registrySource,
      discussion: registryDiscussion,
      installActions: { ai: { state: "available" } },
      onInstall: async () => {},
    }}
  />
{:else}
  <p class="community-application-story__loading" role="status">
    Preparing signed community events…
  </p>
{/if}

<style>
  .community-application-story__unavailable,
  .community-application-story__loading {
    margin: 1rem;
  }

  .community-application-story__unavailable {
    padding: 1rem;
    border: 1px solid var(--destructive);
    border-radius: var(--radius);
    color: var(--destructive);
  }

  .community-application-story__registry-discussion {
    border-top: 1px solid var(--border);
    padding-top: 2rem;
  }
</style>
