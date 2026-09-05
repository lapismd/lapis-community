<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Breadcrumb from "@lapismd/design-core/shadcn/breadcrumb";
  import * as Empty from "@lapismd/design-core/shadcn/empty";
  import { AppShell } from "@lapismd/design-core/shell";
  import CircleAlertIcon from "@lucide/svelte/icons/circle-alert";
  import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
  import PackageSearchIcon from "@lucide/svelte/icons/package-search";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import { onMount, untrack } from "svelte";

  import RegistryCommunity from "../registry-community/RegistryCommunity.svelte";
  import RegistryDirectory from "../registry-directory/RegistryDirectory.svelte";
  import RegistryLanding from "../registry-landing/RegistryLanding.svelte";
  import RegistryPluginDetail from "../registry-plugin-detail/RegistryPluginDetail.svelte";
  import {
    relatedRegistryPlugins,
    RegistryCatalogSession,
    type RegistryCatalogEntry,
    type RegistryCatalogIndex,
    type RegistryDirectoryState,
    type RegistryInstallAction,
    type RegistryResolvedDetail,
    type RegistryRoute,
    type RegistryRuntime,
  } from "../../registry/index.js";
  import type { RegistryBrowserProps } from "./model.js";
  import { provideRegistryImageLoader } from "../registry-verified-image/context.js";

  let {
    source,
    route = $bindable({ page: "landing" }),
    onRouteChange = () => {},
    discussionDataSource,
    discussionIdentity,
    discussion,
    installActions = {},
    onInstall,
  }: RegistryBrowserProps = $props();

  const catalogSource = untrack(() => source);
  provideRegistryImageLoader(catalogSource.loadImage?.bind(catalogSource));

  let index = $state<RegistryCatalogIndex>();
  let runtime = $state<RegistryRuntime | null>(null);
  let catalogLoading = $state(true);
  let catalogError = $state("");
  let selectedDetail = $state<RegistryResolvedDetail>();
  let detailLoading = $state(false);
  let detailError = $state("");
  let sourceStatus = $state(untrack(() => catalogSource.getStatus?.()));
  let directoryState = $state<RegistryDirectoryState>({
    query: "",
    categories: [],
    platforms: [],
    statuses: [],
    officialOnly: false,
    sort: "name",
    view: "grid",
  });

  const catalogSession = untrack(
    () => new RegistryCatalogSession(catalogSource),
  );
  const hoverScrollbarProps = { scrollbarVisibility: "hover" } as const;
  let catalogController: AbortController | undefined;
  let detailController: AbortController | undefined;
  let loadGeneration = 0;
  let detailGeneration = 0;
  let routeTimer: ReturnType<typeof setTimeout> | undefined;

  const selectedEntry = $derived.by(() => {
    const pluginId = route.page === "plugin" ? route.pluginId : undefined;
    if (pluginId === undefined) return undefined;
    return index?.plugins.find((plugin) => plugin.id === pluginId);
  });
  const related = $derived(
    selectedDetail === undefined || index === undefined
      ? []
      : relatedRegistryPlugins(selectedDetail.detail, index.plugins),
  );
  const supportsDiscussion = $derived(
    discussion !== undefined ||
      (runtime !== null &&
        runtime.publisherPubkeys.length > 0 &&
        runtime.relays.length > 0),
  );
  const selectedInstallAction = $derived.by<RegistryInstallAction | undefined>(
    () => {
      if (selectedEntry === undefined) return undefined;
      const configured = installActions[selectedEntry.id];
      if (sourceStatus === undefined || sourceStatus.installReady)
        return configured;
      if (
        configured?.state === "installed" ||
        configured?.state === "installing"
      ) {
        return configured;
      }
      return {
        state: "disabled",
        reason:
          "Connect to a registry relay to confirm current approvals and revocations before installing",
      };
    },
  );

  function navigate(next: RegistryRoute): void {
    clearTimeout(routeTimer);
    routeTimer = setTimeout(() => {
      routeTimer = undefined;
      route = next;
      onRouteChange(next);
    }, 50);
  }

  function openDirectory(category?: string): void {
    if (category !== undefined) {
      directoryState = { ...directoryState, categories: [category] };
    }
    navigate({ page: "directory" });
  }

  function openDirectoryFilter(
    key: "categories" | "platforms",
    value: string,
  ): void {
    directoryState = {
      ...directoryState,
      query: "",
      categories: key === "categories" ? [value] : [],
      platforms: key === "platforms" ? [value] : [],
      statuses: [],
      officialOnly: false,
    };
    navigate({ page: "directory" });
  }

  function openPlugin(plugin: RegistryCatalogEntry): void {
    navigate({ page: "plugin", pluginId: plugin.id });
  }

  async function loadCatalog(background = false): Promise<void> {
    const generation = ++loadGeneration;
    catalogController?.abort();
    catalogController = new AbortController();
    if (!background || index === undefined) catalogLoading = true;
    catalogError = "";
    try {
      const [nextIndex, nextRuntime] = await Promise.all([
        catalogSource.loadIndex({ signal: catalogController.signal }),
        catalogSource.loadRuntime({ signal: catalogController.signal }),
      ]);
      if (generation !== loadGeneration) return;
      index = nextIndex;
      runtime = nextRuntime;
    } catch (cause) {
      if (generation !== loadGeneration || isAbortError(cause)) return;
      catalogError =
        cause instanceof Error
          ? cause.message
          : "The registry could not be loaded";
    } finally {
      if (generation === loadGeneration) catalogLoading = false;
    }
  }

  async function refreshCatalog(): Promise<void> {
    try {
      if (catalogSource.refresh !== undefined) {
        await catalogSource.refresh();
      } else {
        await loadCatalog(index !== undefined);
      }
    } catch {
      // Live sources expose refresh failures through their status event.
    }
  }

  async function resolveDetail(entry: RegistryCatalogEntry): Promise<void> {
    const generation = ++detailGeneration;
    detailController?.abort();
    detailController = new AbortController();
    selectedDetail = undefined;
    detailLoading = true;
    detailError = "";
    try {
      const resolved = await catalogSession.loadDetail(entry, {
        signal: detailController.signal,
      });
      if (generation !== detailGeneration) return;
      selectedDetail = resolved;
    } catch (cause) {
      if (generation !== detailGeneration || isAbortError(cause)) return;
      detailError =
        cause instanceof Error
          ? cause.message
          : "The plugin details could not be loaded";
    } finally {
      if (generation === detailGeneration) detailLoading = false;
    }
  }

  function retryDetail(): void {
    if (selectedEntry !== undefined) void resolveDetail(selectedEntry);
  }

  function isAbortError(cause: unknown): boolean {
    return cause instanceof DOMException && cause.name === "AbortError";
  }

  onMount(() => {
    const unsubscribe = catalogSource.subscribe?.((event) => {
      sourceStatus = event.status;
      if (event.type === "revision") {
        catalogSession.clear();
        void loadCatalog(index !== undefined);
      }
    });
    void loadCatalog();
    return () => {
      loadGeneration += 1;
      detailGeneration += 1;
      catalogController?.abort();
      detailController?.abort();
      clearTimeout(routeTimer);
      unsubscribe?.();
    };
  });

  $effect(() => {
    const entry = selectedEntry;
    if (route.page !== "plugin") {
      untrack(() => {
        detailGeneration += 1;
        detailController?.abort();
        selectedDetail = undefined;
        detailLoading = false;
        detailError = "";
      });
    } else if (entry !== undefined) {
      untrack(() => void resolveDetail(entry));
    }
  });
</script>

{#snippet pluginDiscussion()}
  {#if discussion}
    {@render discussion()}
  {:else if runtime && selectedEntry}
    <RegistryCommunity
      plugin={selectedEntry.id}
      name={selectedEntry.name}
      version={selectedEntry.latestVersion}
      publisher={runtime.publisherPubkeys[0] ?? ""}
      relays={JSON.stringify(runtime.relays)}
      {...discussionDataSource === undefined
        ? {}
        : { dataSource: discussionDataSource }}
      {...discussionIdentity === undefined
        ? {}
        : { identity: discussionIdentity }}
    />
  {/if}
{/snippet}

{#if route.page !== "landing"}
  <AppShell.Toolbar
    class="registry-browser__toolbar"
    label="Registry navigation"
  >
    <Breadcrumb.Root aria-label="Registry breadcrumb">
      <Breadcrumb.List>
        <Breadcrumb.Item>
          <Breadcrumb.Link
            href="#registry"
            onclick={(event) => {
              event.preventDefault();
              navigate({ page: "landing" });
            }}>Registry</Breadcrumb.Link
          >
        </Breadcrumb.Item>
        <Breadcrumb.Separator />
        <Breadcrumb.Item>
          {#if route.page === "directory"}
            <Breadcrumb.Page>Plugins</Breadcrumb.Page>
          {:else}
            <Breadcrumb.Link
              href="#registry:plugins"
              onclick={(event) => {
                event.preventDefault();
                openDirectory();
              }}>Plugins</Breadcrumb.Link
            >
          {/if}
        </Breadcrumb.Item>
        {#if route.page === "plugin"}
          <Breadcrumb.Separator />
          <Breadcrumb.Item>
            <Breadcrumb.Page>
              {selectedEntry?.name ?? route.pluginId}
            </Breadcrumb.Page>
          </Breadcrumb.Item>
        {/if}
      </Breadcrumb.List>
    </Breadcrumb.Root>
  </AppShell.Toolbar>
{/if}

{#if index && sourceStatus && (!sourceStatus.installReady || sourceStatus.phase === "degraded")}
  <AppShell.Toolbar
    class="registry-browser__source-toolbar"
    label="Registry source status"
  >
    <aside class="registry-browser__source-notice" role="status">
      <span>
        <strong>
          {sourceStatus.fresh
            ? "Browsing is available; installs are paused."
            : "Showing a verified cached registry."}
        </strong>
        {sourceStatus.message ??
          "Connect to a registry relay to confirm current approvals and revocations."}
      </span>
      {#if catalogSource.refresh}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onclick={() => void refreshCatalog()}
        >
          <RefreshCwIcon aria-hidden="true" />
          Refresh
        </Button>
      {/if}
    </aside>
  </AppShell.Toolbar>
{/if}

{#if !catalogLoading && !catalogError && index && route.page === "directory"}
  <RegistryDirectory
    plugins={index.plugins}
    bind:state={directoryState}
    onOpenPlugin={openPlugin}
  />
{:else}
  <AppShell.Body layout="regions" label="Plugin registry">
    <AppShell.Body.Content {...hoverScrollbarProps} label="Registry content">
      <section class="registry-browser" data-registry-page={route.page}>
        {#if catalogLoading}
          <div class="registry-browser__state" role="status">
            <LoaderCircleIcon
              class="registry-browser__spinner"
              aria-hidden="true"
            />
            <p>Loading the plugin registry…</p>
          </div>
        {:else if catalogError}
          <Empty.Root class="registry-browser__empty">
            <Empty.Header>
              <Empty.Media variant="icon"
                ><CircleAlertIcon aria-hidden="true" /></Empty.Media
              >
              <Empty.Title>Registry unavailable</Empty.Title>
              <Empty.Description>{catalogError}</Empty.Description>
            </Empty.Header>
            <Empty.Content>
              <Button
                type="button"
                variant="outline"
                onclick={() => void loadCatalog()}>Try again</Button
              >
            </Empty.Content>
          </Empty.Root>
        {:else if index === undefined || index.plugins.length === 0}
          <Empty.Root class="registry-browser__empty">
            <Empty.Header>
              <Empty.Media variant="icon"
                ><PackageSearchIcon aria-hidden="true" /></Empty.Media
              >
              <Empty.Title>No plugins yet</Empty.Title>
              <Empty.Description>
                The registry projection does not contain any plugins.
              </Empty.Description>
            </Empty.Header>
          </Empty.Root>
        {:else if route.page === "landing"}
          <RegistryLanding
            plugins={index.plugins}
            onOpenDirectory={() => openDirectory()}
            onOpenCategory={openDirectory}
            onOpenPlugin={openPlugin}
          />
        {:else if selectedEntry === undefined}
          <Empty.Root class="registry-browser__empty">
            <Empty.Header>
              <Empty.Media variant="icon"
                ><PackageSearchIcon aria-hidden="true" /></Empty.Media
              >
              <Empty.Title>Plugin not found</Empty.Title>
              <Empty.Description>
                The selected plugin is not present in this registry projection.
              </Empty.Description>
            </Empty.Header>
            <Empty.Content>
              <Button
                type="button"
                variant="outline"
                onclick={() => openDirectory()}>Browse plugins</Button
              >
            </Empty.Content>
          </Empty.Root>
        {:else if detailLoading}
          <div class="registry-browser__state" role="status">
            <LoaderCircleIcon
              class="registry-browser__spinner"
              aria-hidden="true"
            />
            <p>Loading {selectedEntry.name}…</p>
          </div>
        {:else if detailError || selectedDetail === undefined}
          <Empty.Root class="registry-browser__empty">
            <Empty.Header>
              <Empty.Media variant="icon"
                ><CircleAlertIcon aria-hidden="true" /></Empty.Media
              >
              <Empty.Title>Plugin details unavailable</Empty.Title>
              <Empty.Description>
                {detailError || "The plugin details could not be loaded."}
              </Empty.Description>
            </Empty.Header>
            <Empty.Content>
              <Button type="button" variant="outline" onclick={retryDetail}
                >Try again</Button
              >
            </Empty.Content>
          </Empty.Root>
        {:else}
          <RegistryPluginDetail
            resolved={selectedDetail}
            {related}
            {...selectedInstallAction === undefined
              ? {}
              : { installAction: selectedInstallAction }}
            {...onInstall === undefined ? {} : { onInstall }}
            onOpenPlugin={openPlugin}
            onOpenCategory={(category) =>
              openDirectoryFilter("categories", category)}
            onOpenPlatform={(platform) =>
              openDirectoryFilter("platforms", platform)}
            {...supportsDiscussion ? { discussion: pluginDiscussion } : {}}
          />
        {/if}
      </section>
    </AppShell.Body.Content>
  </AppShell.Body>
{/if}

<style>
  :global(.registry-browser__toolbar) {
    padding-inline: 0.75rem;
  }

  :global(.registry-browser__toolbar [data-ui-part="breadcrumb"]),
  :global(.registry-browser__toolbar [data-ui-part="breadcrumb-list"]) {
    min-width: 0;
  }

  :global(.registry-browser__toolbar [data-ui-part="breadcrumb-list"]) {
    flex-wrap: nowrap;
    gap: 0.3rem;
    margin: 0;
    padding: 0;
  }

  :global(.registry-browser__toolbar [data-ui-part="breadcrumb-item"]) {
    min-width: 0;
  }

  :global(.registry-browser__toolbar [data-ui-part="breadcrumb-separator"]) {
    gap: 0;
  }

  :global(
      .registry-browser__toolbar [data-ui-part="breadcrumb-separator"] svg
    ) {
    width: 0.75rem;
    height: 0.75rem;
  }

  :global(.registry-browser__toolbar [data-ui-part="breadcrumb-page"]) {
    overflow: hidden;
    font-weight: 650;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .registry-browser {
    min-height: 100%;
    color: var(--foreground);
    background: var(--background);
  }

  .registry-browser__source-notice {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    width: 100%;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.65rem 0.75rem;
    color: var(--muted-foreground);
    background: var(--muted);
    font-size: 0.8rem;
  }

  :global(.registry-browser__source-toolbar) {
    min-height: auto;
    padding: 0.5rem 0.75rem;
  }

  .registry-browser__source-notice span {
    display: grid;
    gap: 0.15rem;
  }

  .registry-browser__source-notice strong {
    color: var(--foreground);
  }

  .registry-browser__source-notice :global(svg) {
    width: 0.9rem;
    height: 0.9rem;
  }

  .registry-browser__state,
  :global(.registry-browser__empty) {
    display: grid;
    place-content: center;
    min-height: 24rem;
    padding: 2rem;
    text-align: center;
  }

  .registry-browser__state {
    gap: 0.75rem;
    color: var(--muted-foreground);
  }

  .registry-browser__state p {
    margin: 0;
  }

  :global(.registry-browser__spinner) {
    width: 1.5rem;
    height: 1.5rem;
    margin-inline: auto;
    animation: registry-spin 0.9s linear infinite;
  }

  @keyframes registry-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.registry-browser__spinner) {
      animation: none;
    }
  }
</style>
