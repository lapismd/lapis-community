<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Breadcrumb from "@lapismd/design-core/shadcn/breadcrumb";
  import * as Empty from "@lapismd/design-core/shadcn/empty";
  import { AppShell } from "@lapismd/design-core/shell";
  import CircleAlertIcon from "@lucide/svelte/icons/circle-alert";
  import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
  import PackageSearchIcon from "@lucide/svelte/icons/package-search";
  import SlashIcon from "@lucide/svelte/icons/slash";
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
    type RegistryResolvedDetail,
    type RegistryRoute,
    type RegistryRuntime,
  } from "../../registry/index.js";
  import type { RegistryBrowserProps } from "./model.js";

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

  let index = $state<RegistryCatalogIndex>();
  let runtime = $state<RegistryRuntime | null>(null);
  let catalogLoading = $state(true);
  let catalogError = $state("");
  let selectedDetail = $state<RegistryResolvedDetail>();
  let detailLoading = $state(false);
  let detailError = $state("");
  let directoryState = $state<RegistryDirectoryState>({
    query: "",
    categories: [],
    platforms: [],
    statuses: [],
    officialOnly: false,
    sort: "name",
    view: "grid",
  });

  const catalogSession = untrack(() => new RegistryCatalogSession(source));
  const hoverScrollbarProps = { scrollbarVisibility: "hover" } as const;
  let catalogController: AbortController | undefined;
  let detailController: AbortController | undefined;
  let loadGeneration = 0;
  let detailGeneration = 0;

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

  function navigate(next: RegistryRoute): void {
    route = next;
    onRouteChange(next);
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

  async function loadCatalog(): Promise<void> {
    const generation = ++loadGeneration;
    catalogController?.abort();
    catalogController = new AbortController();
    catalogLoading = true;
    catalogError = "";
    try {
      const [nextIndex, nextRuntime] = await Promise.all([
        source.loadIndex({ signal: catalogController.signal }),
        source.loadRuntime({ signal: catalogController.signal }),
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
    void loadCatalog();
    return () => {
      loadGeneration += 1;
      detailGeneration += 1;
      catalogController?.abort();
      detailController?.abort();
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
        <Breadcrumb.Separator><SlashIcon /></Breadcrumb.Separator>
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
          <Breadcrumb.Separator><SlashIcon /></Breadcrumb.Separator>
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
            {...installActions[selectedEntry.id] === undefined
              ? {}
              : { installAction: installActions[selectedEntry.id] }}
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
