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
    sourceMode?:
      | "static"
      | "cached"
      | "refreshing-cache"
      | "loading"
      | "rollback";
  } = $props();
  const fixtureSource = createRegistryStoryDataSource();
  const sourceListeners = new Set<RegistryCatalogSourceListener>();
  const initialSourceMode = untrack(() => sourceMode);
  let liveStatus: RegistryCatalogSourceStatus = {
    phase: initialSourceMode === "refreshing-cache" ? "refreshing" : "degraded",
    fresh: false,
    installReady: false,
    origin: initialSourceMode === "rollback" ? "relay" : "cache",
    registryRoot: "cached-story-root",
    synchronizedAt: "2026-09-03T12:00:00.000Z",
    message:
      initialSourceMode === "rollback"
        ? "The Registry relay returned an older trusted checkpoint."
        : initialSourceMode === "refreshing-cache"
          ? "Checking the registry relay for updates."
          : "The registry relay is unavailable.",
    ...(initialSourceMode === "rollback" ? { trust: "rollback" as const } : {}),
    relays: [{ relay: "wss://relay.example", error: "offline" }],
  };
  const loadingStatus: RegistryCatalogSourceStatus = {
    phase: "loading",
    fresh: false,
    installReady: false,
    message: "Checking configured registry relays.",
    relays: [{ relay: "wss://relay.example" }],
  };

  function waitForAbort<T>(signal?: AbortSignal): Promise<T> {
    return new Promise<T>((_resolve, reject) => {
      const abort = () =>
        reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
      if (signal?.aborted) abort();
      else signal?.addEventListener("abort", abort, { once: true });
    });
  }

  const loadingSource: RegistryCatalogDataSource = {
    ...fixtureSource,
    getStatus: () => loadingStatus,
    subscribe(listener) {
      listener({ type: "status", status: loadingStatus });
      return () => {};
    },
    loadIndex: (options) => waitForAbort(options?.signal),
    loadRuntime: (options) => waitForAbort(options?.signal),
  };
  const source: RegistryCatalogDataSource & {
    detailLoads?: ReadonlyMap<string, number>;
  } =
    initialSourceMode === "static"
      ? fixtureSource
      : initialSourceMode === "loading"
        ? loadingSource
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
            async resetTrustHistory() {
              trustResetCount += 1;
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
  let trustResetCount = $state(0);
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
  data-testid="registry-browser-story"
  style="--ui-shell-height: 100vh"
  data-route={route.page}
  data-view={route.page === "plugin" ? (route.view ?? "details") : ""}
  data-version={route.page === "plugin" ? (route.version ?? "latest") : ""}
  data-trust-resets={trustResetCount}
  data-ai-detail-loads={source.detailLoads?.get("ai") ?? 0}
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
