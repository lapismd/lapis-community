<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Breadcrumb from "@lapismd/design-core/shadcn/breadcrumb";
  import * as Empty from "@lapismd/design-core/shadcn/empty";
  import { Skeleton } from "@lapismd/design-core/shadcn/skeleton";
  import * as Tooltip from "@lapismd/design-core/shadcn/tooltip";
  import { AppShell } from "@lapismd/design-core/shell";
  import CircleAlertIcon from "@lucide/svelte/icons/circle-alert";
  import PackageSearchIcon from "@lucide/svelte/icons/package-search";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert";
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
  const skeletonLanes = [0, 1, 2] as const;
  const sourceNoticeDelayMs = 15_000;
  let catalogController: AbortController | undefined;
  let detailController: AbortController | undefined;
  let loadGeneration = 0;
  let detailGeneration = 0;
  let routeTimer: ReturnType<typeof setTimeout> | undefined;
  let sourceNoticeTimer: ReturnType<typeof setTimeout> | undefined;
  let sourceNoticeDelayElapsed = $state(false);

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
  const sourceNoticeIsTransient = $derived(
    sourceStatus?.phase === "loading" ||
      sourceStatus?.phase === "refreshing" ||
      (sourceStatus?.phase === "ready" && sourceStatus.origin === "cache"),
  );
  const showSourceNotice = $derived(
    index !== undefined &&
      sourceStatus !== undefined &&
      (!sourceStatus.installReady || sourceStatus.phase === "degraded") &&
      (!sourceNoticeIsTransient || sourceNoticeDelayElapsed),
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
      clearTimeout(sourceNoticeTimer);
      unsubscribe?.();
    };
  });

  $effect(() => {
    const transient = sourceNoticeIsTransient;
    untrack(() => {
      clearTimeout(sourceNoticeTimer);
      if (!transient) {
        sourceNoticeDelayElapsed = true;
        return;
      }
      sourceNoticeDelayElapsed = false;
      sourceNoticeTimer = setTimeout(() => {
        sourceNoticeDelayElapsed = true;
      }, sourceNoticeDelayMs);
    });
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

{#snippet loadingSkeleton(label: string)}
  <div
    class="registry-browser__loading"
    role="status"
    aria-label={label}
    aria-live="polite"
  >
    <span class="registry-browser__sr-only">{label}</span>
    <div class="registry-browser__skeleton" aria-hidden="true">
      <header class="registry-browser__skeleton-hero">
        <Skeleton class="registry-browser__skeleton-eyebrow" />
        <Skeleton class="registry-browser__skeleton-title" />
        <Skeleton class="registry-browser__skeleton-copy" />
      </header>
      <div class="registry-browser__skeleton-heading">
        <Skeleton />
        <Skeleton />
      </div>
      <div class="registry-browser__skeleton-lanes">
        {#each skeletonLanes as lane (lane)}
          <section>
            <Skeleton class="registry-browser__skeleton-lane-title" />
            {#each skeletonLanes as row (row)}
              <div class="registry-browser__skeleton-row">
                <Skeleton class="registry-browser__skeleton-icon" />
                <span>
                  <Skeleton class="registry-browser__skeleton-row-title" />
                  <Skeleton class="registry-browser__skeleton-row-copy" />
                </span>
              </div>
            {/each}
          </section>
        {/each}
      </div>
    </div>
  </div>
{/snippet}

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

{#if showSourceNotice && sourceStatus}
  <AppShell.Toolbar
    class="registry-browser__source-toolbar"
    label="Registry source status"
  >
    <div class="registry-browser__source-notice" role="status">
      <TriangleAlertIcon aria-hidden="true" />
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
        <Tooltip.Provider>
          <Tooltip.Root>
            <Tooltip.Trigger>
              {#snippet child({ props })}
                <Button
                  {...props}
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Refresh registry"
                  onclick={() => void refreshCatalog()}
                >
                  <RefreshCwIcon aria-hidden="true" />
                </Button>
              {/snippet}
            </Tooltip.Trigger>
            <Tooltip.Content side="bottom" sideOffset={6}>
              Refresh registry
            </Tooltip.Content>
          </Tooltip.Root>
        </Tooltip.Provider>
      {/if}
    </div>
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
          {@render loadingSkeleton("Loading the plugin registry")}
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
          {@render loadingSkeleton(`Loading ${selectedEntry.name}`)}
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
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 1rem;
    width: 100%;
    border: 0;
    border-radius: var(--radius) var(--radius) 0 0;
    padding: 0.65rem 0.75rem;
    color: var(--muted-foreground);
    background: var(--muted);
    font-size: 0.8rem;
  }

  :global(.registry-browser__source-toolbar) {
    min-height: auto;
    padding: 0;
  }

  .registry-browser__source-notice span {
    display: grid;
    gap: 0.15rem;
    min-width: 0;
  }

  .registry-browser__source-notice strong {
    color: var(--foreground);
  }

  .registry-browser__source-notice :global(svg) {
    width: 0.9rem;
    height: 0.9rem;
  }

  .registry-browser__source-notice > :global(svg:first-child) {
    color: var(--muted-foreground);
  }

  :global(.registry-browser__empty) {
    display: grid;
    place-content: center;
    min-height: 24rem;
    padding: 2rem;
    text-align: center;
  }

  .registry-browser__loading {
    width: 100%;
    min-height: 24rem;
  }

  .registry-browser__sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    clip-path: inset(50%);
  }

  .registry-browser__skeleton {
    display: grid;
    gap: clamp(2rem, 5vw, 4rem);
    width: min(100%, 76rem);
    margin-inline: auto;
    padding: clamp(2rem, 6vw, 5rem) clamp(1rem, 4vw, 3rem);
  }

  .registry-browser__skeleton-hero {
    display: grid;
    justify-items: center;
    gap: 0.85rem;
    padding-block: clamp(1rem, 5vw, 3rem);
  }

  :global(.registry-browser__skeleton-eyebrow) {
    width: 8rem;
    height: 0.9rem;
  }

  :global(.registry-browser__skeleton-title) {
    width: min(75%, 29rem);
    height: clamp(2.5rem, 6vw, 4.5rem);
  }

  :global(.registry-browser__skeleton-copy) {
    width: min(60%, 22rem);
    height: 1rem;
  }

  .registry-browser__skeleton-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .registry-browser__skeleton-heading
    :global([data-ui-component="skeleton"]:first-child) {
    width: 8rem;
    height: 1.5rem;
  }

  .registry-browser__skeleton-heading
    :global([data-ui-component="skeleton"]:last-child) {
    width: 1.25rem;
    height: 1.25rem;
  }

  .registry-browser__skeleton-lanes {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: clamp(1.5rem, 4vw, 3rem);
  }

  .registry-browser__skeleton-lanes section {
    display: grid;
    align-content: start;
    gap: 1rem;
  }

  :global(.registry-browser__skeleton-lane-title) {
    width: 5rem;
    height: 1rem;
  }

  .registry-browser__skeleton-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
    padding-block: 0.25rem;
  }

  .registry-browser__skeleton-row > span {
    display: grid;
    gap: 0.45rem;
    min-width: 0;
  }

  :global(.registry-browser__skeleton-icon) {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: var(--radius);
  }

  :global(.registry-browser__skeleton-row-title) {
    width: min(65%, 8rem);
    height: 0.85rem;
  }

  :global(.registry-browser__skeleton-row-copy) {
    width: 100%;
    height: 0.7rem;
  }

  @media (max-width: 54rem) {
    .registry-browser__skeleton-lanes {
      grid-template-columns: 1fr;
    }
  }
</style>
