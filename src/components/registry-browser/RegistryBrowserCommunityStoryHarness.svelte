<script lang="ts">
  import { AppShell, AppShellController } from "@lapismd/design-core/shell";
  import { onMount, untrack } from "svelte";

  import { LAPIS_GROUPS, lapisGroupId } from "../../protocol/index.js";
  import type {
    RegistryCatalogDataSource,
    RegistryRoute,
  } from "../../registry/index.js";
  import {
    createRegistryCommunityStoryRuntime,
    type RegistryCommunityStoryRuntime,
  } from "../../testing/index.js";
  import RegistryBrowser from "./RegistryBrowser.svelte";
  import { createRegistryStoryDataSource } from "./story-fixtures.js";

  let {
    initialRoute = { page: "plugin", pluginId: "ai", view: "reviews" },
  }: { initialRoute?: RegistryRoute } = $props();

  const shell = untrack(
    () =>
      new AppShellController({
        rightClosed: true,
        sidebarMinWidth: 48,
        sidebarMaxWidth: 440,
      }),
  );
  let route = $state<RegistryRoute>(untrack(() => initialRoute));
  let runtime = $state<RegistryCommunityStoryRuntime>();
  let source = $state<RegistryCatalogDataSource>();
  let error = $state("");

  onMount(() => {
    let active = true;
    void createRegistryCommunityStoryRuntime({
      plugin: "ai",
      name: "AI Assistant",
      postCount: 42,
      suggestedTopicCount: 3,
      includeReleaseEvents: true,
    })
      .then((created) => {
        if (!active) {
          created.dispose();
          return;
        }
        const catalog = createRegistryStoryDataSource();
        runtime = created;
        source = {
          ...catalog,
          async loadRuntime() {
            return {
              schemaVersion: 1,
              backend: "nostr-nip29",
              registryRoot: "registry-browser-community-story",
              relays: [created.scenario.relayUrl],
              releaseGroupId: lapisGroupId(LAPIS_GROUPS.pluginReleases),
              curatorPubkeys: [],
              publisherPubkeys: [created.scenario.publisher],
            };
          },
        };
      })
      .catch((cause: unknown) => {
        if (active) {
          error = cause instanceof Error ? cause.message : "Story setup failed";
        }
      });
    return () => {
      active = false;
      runtime?.dispose();
    };
  });
</script>

{#if error}
  <p role="alert">{error}</p>
{:else if runtime && source}
  <AppShell.Root
    controller={shell}
    class="registry-browser-community-story"
    style="--ui-shell-height: 100vh"
    data-testid="registry-browser-community-story"
    data-route={route.page === "plugin"
      ? (route.view ?? "details")
      : route.page}
  >
    <AppShell.Main>
      <RegistryBrowser
        {source}
        bind:route
        discussionDataSource={runtime.dataSource}
        {...runtime.identity === undefined
          ? {}
          : { discussionIdentity: runtime.identity }}
      />
    </AppShell.Main>
  </AppShell.Root>
{:else}
  <p role="status">Preparing routed Registry reviews…</p>
{/if}

<style>
  :global(.registry-browser-community-story) {
    height: 100vh;
  }
</style>
