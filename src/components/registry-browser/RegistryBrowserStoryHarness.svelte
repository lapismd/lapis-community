<script lang="ts">
  import { AppShell, AppShellController } from "@lapismd/design-core/shell";
  import { untrack } from "svelte";

  import type {
    RegistryCatalogDataSource,
    RegistryCatalogSourceListener,
    RegistryCatalogSourceStatus,
    RegistryInstallAction,
    RegistryRoute,
  } from "../../registry/index.js";
  import RegistryCommunityStoryHarness from "../registry-community/RegistryCommunityStoryHarness.svelte";
  import RegistryBrowser from "./RegistryBrowser.svelte";
  import { createRegistryStoryDataSource } from "./story-fixtures.js";

  let {
    initialRoute = { page: "landing" },
    sourceMode = "static",
  }: {
    initialRoute?: RegistryRoute;
    sourceMode?: "static" | "cached";
  } = $props();
  const fixtureSource = createRegistryStoryDataSource();
  const sourceListeners = new Set<RegistryCatalogSourceListener>();
  let liveStatus: RegistryCatalogSourceStatus = {
    phase: "ready",
    fresh: false,
    installReady: false,
    origin: "cache",
    registryRoot: "cached-story-root",
    synchronizedAt: "2026-09-03T12:00:00.000Z",
    message: "The registry relay is unavailable.",
    relays: [{ relay: "wss://relay.example", error: "offline" }],
  };
  const initialSourceMode = untrack(() => sourceMode);
  const source: RegistryCatalogDataSource & {
    detailLoads: ReadonlyMap<string, number>;
  } =
    initialSourceMode === "static"
      ? fixtureSource
      : {
          ...fixtureSource,
          getStatus: () => liveStatus,
          subscribe(listener) {
            sourceListeners.add(listener);
            listener({ type: "status", status: liveStatus });
            return () => sourceListeners.delete(listener);
          },
          async refresh() {
            liveStatus = {
              phase: "ready",
              fresh: true,
              installReady: true,
              origin: "relay",
              registryRoot: "fresh-story-root",
              synchronizedAt: "2026-09-03T12:01:00.000Z",
              relays: [{ relay: "wss://relay.example" }],
            };
            for (const listener of sourceListeners) {
              listener({ type: "revision", status: liveStatus });
            }
          },
          dispose() {
            sourceListeners.clear();
          },
        };
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
  data-ai-detail-loads={fixtureSource.detailLoads.get("ai") ?? 0}
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
