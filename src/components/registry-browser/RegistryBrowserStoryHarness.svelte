<script lang="ts">
  import { AppShell, AppShellController } from "@lapismd/design-core/shell";
  import { untrack } from "svelte";

  import type {
    RegistryInstallAction,
    RegistryRoute,
  } from "../../registry/index.js";
  import RegistryCommunityStoryHarness from "../registry-community/RegistryCommunityStoryHarness.svelte";
  import RegistryBrowser from "./RegistryBrowser.svelte";
  import { createRegistryStoryDataSource } from "./story-fixtures.js";

  let { initialRoute = { page: "landing" } }: { initialRoute?: RegistryRoute } =
    $props();
  const source = createRegistryStoryDataSource();
  const shell = untrack(
    () =>
      new AppShellController({
        rightClosed: true,
        sidebarMinWidth: 48,
        sidebarMaxWidth: 440,
      }),
  );
  let route = $state<RegistryRoute>(untrack(() => initialRoute));
  let installActions = $state<Record<string, RegistryInstallAction>>({
    ai: { state: "available" },
  });

  async function install(): Promise<void> {
    installActions = { ...installActions, ai: { state: "installed" } };
  }
</script>

{#snippet discussion()}
  <div class="registry-browser-story__discussion">
    <RegistryCommunityStoryHarness />
  </div>
{/snippet}

<AppShell.Root
  controller={shell}
  class="registry-browser-story"
  style="--ui-shell-height: 100vh"
  data-route={route.page}
  data-ai-detail-loads={source.detailLoads.get("ai") ?? 0}
>
  <AppShell.Main>
    <RegistryBrowser
      {source}
      bind:route
      {discussion}
      {installActions}
      onInstall={install}
    />
  </AppShell.Main>
</AppShell.Root>

<style>
  :global(.registry-browser-story) {
    height: 100vh;
  }

  .registry-browser-story__discussion {
    border-top: 1px solid var(--border);
    padding-top: 2rem;
  }
</style>
