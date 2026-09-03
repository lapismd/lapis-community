<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Collapsible from "@lapismd/design-core/shadcn/collapsible";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import { AppShell } from "@lapismd/design-core/shell";
  import BadgeCheckIcon from "@lucide/svelte/icons/badge-check";
  import BlocksIcon from "@lucide/svelte/icons/blocks";
  import CheckIcon from "@lucide/svelte/icons/check";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import CircleOffIcon from "@lucide/svelte/icons/circle-off";
  import DatabaseIcon from "@lucide/svelte/icons/database";
  import FileTextIcon from "@lucide/svelte/icons/file-text";
  import GlobeIcon from "@lucide/svelte/icons/globe";
  import LayoutDashboardIcon from "@lucide/svelte/icons/layout-dashboard";
  import LayoutGridIcon from "@lucide/svelte/icons/layout-grid";
  import ListIcon from "@lucide/svelte/icons/list";
  import MonitorIcon from "@lucide/svelte/icons/monitor";
  import NetworkIcon from "@lucide/svelte/icons/network";
  import NotebookTabsIcon from "@lucide/svelte/icons/notebook-tabs";
  import PackageIcon from "@lucide/svelte/icons/package";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import PresentationIcon from "@lucide/svelte/icons/presentation";
  import SearchIcon from "@lucide/svelte/icons/search";
  import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
  import SlidersHorizontalIcon from "@lucide/svelte/icons/sliders-horizontal";
  import SparklesIcon from "@lucide/svelte/icons/sparkles";
  import SquareDashedMousePointerIcon from "@lucide/svelte/icons/square-dashed-mouse-pointer";
  import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert";
  import WrenchIcon from "@lucide/svelte/icons/wrench";
  import XIcon from "@lucide/svelte/icons/x";
  import ZapIcon from "@lucide/svelte/icons/zap";

  import {
    collectRegistryCategories,
    filterRegistryEntries,
    registryStatusLabel,
    titleCaseRegistryValue,
    type RegistryCatalogEntry,
    type RegistryCatalogStatus,
    type RegistryDirectoryState,
  } from "../../registry/index.js";
  import RegistryPluginCard from "../registry-plugin-card/RegistryPluginCard.svelte";

  let {
    plugins,
    state: directoryState = $bindable(),
    onOpenPlugin = () => {},
  }: {
    plugins: readonly RegistryCatalogEntry[];
    state: RegistryDirectoryState;
    onOpenPlugin?: (plugin: RegistryCatalogEntry) => void;
  } = $props();

  let bodyElement = $state<HTMLElement | null>(null);
  let filterElement = $state<HTMLElement | null>(null);
  let filterWidth = $state<number>();
  let resizePointerId = $state<number | null>(null);
  let resizeStartX = 0;
  let resizeStartWidth = 0;
  let typeOpen = $state(true);
  let statusOpen = $state(true);
  let categoryOpen = $state(true);
  let platformOpen = $state(true);
  let otherOpen = $state(true);
  let categoriesExpanded = $state(false);
  const results = $derived(filterRegistryEntries(plugins, directoryState));
  const categories = $derived(collectRegistryCategories(plugins));
  const platforms = $derived(
    [...new Set(plugins.flatMap((plugin) => plugin.platforms))].toSorted(),
  );
  const statuses = $derived<RegistryCatalogStatus[]>([
    "active",
    "pending",
    "deprecated",
    "disabled",
    "revoked",
  ]);
  const activeFilterCount = $derived(
    directoryState.categories.length +
      directoryState.platforms.length +
      directoryState.statuses.length +
      (directoryState.officialOnly ? 1 : 0),
  );
  const resizeMinimum = 192;
  const hoverScrollbarProps = { scrollbarVisibility: "hover" } as const;
  const resizeMaximum = $derived(resizeBounds().max);
  const presentedFilterWidth = $derived(
    Math.round(
      filterWidth ?? filterElement?.getBoundingClientRect().width ?? 224,
    ),
  );

  const registryFilterIcons: Record<string, typeof PackageIcon> = {
    active: BadgeCheckIcon,
    all: SlidersHorizontalIcon,
    automation: ZapIcon,
    canvas: SquareDashedMousePointerIcon,
    database: DatabaseIcon,
    deprecated: TriangleAlertIcon,
    desktop: MonitorIcon,
    "developer-tools": WrenchIcon,
    diagnostics: SlidersHorizontalIcon,
    disabled: CircleOffIcon,
    documents: FileTextIcon,
    editor: PencilIcon,
    graph: NetworkIcon,
    markdown: FileTextIcon,
    notebook: NotebookTabsIcon,
    official: ShieldCheckIcon,
    organization: LayoutDashboardIcon,
    package: PackageIcon,
    pending: SparklesIcon,
    presentation: PresentationIcon,
    revoked: ShieldCheckIcon,
    search: SearchIcon,
    themes: BlocksIcon,
    verified: BadgeCheckIcon,
    viewer: FileTextIcon,
    visualization: NetworkIcon,
    web: GlobeIcon,
  };

  function replaceState(next: Partial<RegistryDirectoryState>): void {
    directoryState = { ...directoryState, ...next };
  }

  function toggleListValue<T extends string>(
    key: "categories" | "platforms" | "statuses",
    value: T,
  ): void {
    const current = directoryState[key] as readonly T[];
    replaceState({
      [key]: current.includes(value)
        ? current.filter((candidate) => candidate !== value)
        : [...current, value],
    });
  }

  function resetFilters(): void {
    replaceState({
      categories: [],
      platforms: [],
      statuses: [],
      officialOnly: false,
    });
  }

  function countFor(
    predicate: (plugin: RegistryCatalogEntry) => boolean,
  ): number {
    return plugins.filter(predicate).length;
  }

  function resizeBounds(): { min: number; max: number } {
    const available = (bodyElement?.clientWidth ?? 768) - 384;
    return {
      min: resizeMinimum,
      max: Math.max(resizeMinimum, Math.min(384, available)),
    };
  }

  function clampFilterWidth(width: number): number {
    const { min, max } = resizeBounds();
    return Math.min(max, Math.max(min, width));
  }

  function currentFilterWidth(): number {
    return filterWidth ?? filterElement?.getBoundingClientRect().width ?? 224;
  }

  function beginResize(event: PointerEvent): void {
    if (event.button !== 0) return;
    resizePointerId = event.pointerId;
    resizeStartX = event.clientX;
    resizeStartWidth = currentFilterWidth();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function moveResize(event: PointerEvent): void {
    if (event.pointerId !== resizePointerId) return;
    filterWidth = clampFilterWidth(
      resizeStartWidth + event.clientX - resizeStartX,
    );
  }

  function finishResize(event: PointerEvent): void {
    if (event.pointerId !== resizePointerId) return;
    resizePointerId = null;
    const handle = event.currentTarget as HTMLElement;
    if (handle.hasPointerCapture(event.pointerId)) {
      handle.releasePointerCapture(event.pointerId);
    }
  }

  function resizeWithKeyboard(event: KeyboardEvent): void {
    const { min, max } = resizeBounds();
    let nextWidth = currentFilterWidth();
    if (event.key === "ArrowLeft") nextWidth -= 16;
    else if (event.key === "ArrowRight") nextWidth += 16;
    else if (event.key === "Home") nextWidth = min;
    else if (event.key === "End") nextWidth = max;
    else return;
    event.preventDefault();
    filterWidth = clampFilterWidth(nextWidth);
  }

  function filterIcon(id: string, selected: boolean): typeof PackageIcon {
    return selected ? CheckIcon : (registryFilterIcons[id] ?? PackageIcon);
  }
</script>

{#snippet filterMark(id: string, selected = false)}
  {@const Icon = filterIcon(id, selected)}
  <span
    class="registry-directory__filter-icon"
    data-filter-icon={selected ? "check" : id}
  >
    <Icon aria-hidden="true" />
  </span>
{/snippet}

{#snippet filters()}
  <div class="registry-directory__filter-groups">
    <Collapsible.Root bind:open={typeOpen} class="registry-directory__group">
      <h2>
        <Collapsible.Trigger
          class="registry-directory__group-trigger"
          aria-label={`${typeOpen ? "Collapse" : "Expand"} Type filters`}
        >
          <span>Type</span>
          <ChevronDownIcon aria-hidden="true" />
        </Collapsible.Trigger>
      </h2>
      <Collapsible.Content class="registry-directory__group-content">
        <button
          type="button"
          class="registry-directory__filter selected"
          aria-pressed="true"
        >
          <span>{@render filterMark("package")} Plugins</span>
          <span>{plugins.length}</span>
        </button>
      </Collapsible.Content>
    </Collapsible.Root>

    <Collapsible.Root bind:open={statusOpen} class="registry-directory__group">
      <h2>
        <Collapsible.Trigger
          class="registry-directory__group-trigger"
          aria-label={`${statusOpen ? "Collapse" : "Expand"} Status filters`}
        >
          <span>Status</span>
          <ChevronDownIcon aria-hidden="true" />
        </Collapsible.Trigger>
      </h2>
      <Collapsible.Content class="registry-directory__group-content">
        {#each statuses as status}
          <button
            type="button"
            class="registry-directory__filter"
            class:selected={directoryState.statuses.includes(status)}
            aria-pressed={directoryState.statuses.includes(status)}
            onclick={() => toggleListValue("statuses", status)}
          >
            <span>
              {@render filterMark(
                status,
                directoryState.statuses.includes(status),
              )}
              {registryStatusLabel(status)}
            </span>
            <span>{countFor((plugin) => plugin.status === status)}</span>
          </button>
        {/each}
      </Collapsible.Content>
    </Collapsible.Root>

    <Collapsible.Root
      bind:open={categoryOpen}
      class="registry-directory__group"
    >
      <h2>
        <Collapsible.Trigger
          class="registry-directory__group-trigger"
          aria-label={`${categoryOpen ? "Collapse" : "Expand"} Category filters`}
        >
          <span>Categories</span>
          <ChevronDownIcon aria-hidden="true" />
        </Collapsible.Trigger>
      </h2>
      <Collapsible.Content class="registry-directory__group-content">
        {#each categories as category, index (category.id)}
          {#if categoriesExpanded || index < 8}
            <button
              type="button"
              class="registry-directory__filter"
              class:selected={directoryState.categories.includes(category.id)}
              aria-pressed={directoryState.categories.includes(category.id)}
              onclick={() => toggleListValue("categories", category.id)}
            >
              <span>
                {@render filterMark(
                  category.id,
                  directoryState.categories.includes(category.id),
                )}
                {category.label}
              </span>
              <span>{category.count}</span>
            </button>
          {/if}
        {/each}
        {#if categories.length > 8}
          <button
            class="registry-directory__show-more"
            type="button"
            aria-expanded={categoriesExpanded}
            onclick={() => (categoriesExpanded = !categoriesExpanded)}
          >
            {categoriesExpanded ? "Show less" : "Show more"}
          </button>
        {/if}
      </Collapsible.Content>
    </Collapsible.Root>

    <Collapsible.Root
      bind:open={platformOpen}
      class="registry-directory__group"
    >
      <h2>
        <Collapsible.Trigger
          class="registry-directory__group-trigger"
          aria-label={`${platformOpen ? "Collapse" : "Expand"} Platform filters`}
        >
          <span>Platforms</span>
          <ChevronDownIcon aria-hidden="true" />
        </Collapsible.Trigger>
      </h2>
      <Collapsible.Content class="registry-directory__group-content">
        {#each platforms as platform}
          <button
            type="button"
            class="registry-directory__filter"
            class:selected={directoryState.platforms.includes(platform)}
            aria-pressed={directoryState.platforms.includes(platform)}
            onclick={() => toggleListValue("platforms", platform)}
          >
            <span>
              {@render filterMark(
                platform,
                directoryState.platforms.includes(platform),
              )}
              {titleCaseRegistryValue(platform)}
            </span>
            <span>
              {countFor((plugin) => plugin.platforms.includes(platform))}
            </span>
          </button>
        {/each}
      </Collapsible.Content>
    </Collapsible.Root>

    <Collapsible.Root bind:open={otherOpen} class="registry-directory__group">
      <h2>
        <Collapsible.Trigger
          class="registry-directory__group-trigger"
          aria-label={`${otherOpen ? "Collapse" : "Expand"} Other filters`}
        >
          <span>Other</span>
          <ChevronDownIcon aria-hidden="true" />
        </Collapsible.Trigger>
      </h2>
      <Collapsible.Content class="registry-directory__group-content">
        <button
          type="button"
          class="registry-directory__filter"
          class:selected={directoryState.officialOnly}
          aria-pressed={directoryState.officialOnly}
          onclick={() =>
            replaceState({ officialOnly: !directoryState.officialOnly })}
        >
          <span>
            {@render filterMark("official", directoryState.officialOnly)}
            Official
          </span>
          <span>{countFor((plugin) => plugin.channel === "official")}</span>
        </button>
      </Collapsible.Content>
    </Collapsible.Root>
  </div>
{/snippet}

<AppShell.Body
  bind:ref={bodyElement}
  layout="regions"
  label="Plugin directory"
  class="registry-directory"
  style={filterWidth === undefined
    ? undefined
    : `--ui-shell-body-sidebar-width: ${filterWidth}px`}
>
  <AppShell.Body.Sidebar
    {...hoverScrollbarProps}
    bind:ref={filterElement}
    panelId="registry-filters"
    side="left"
    label="Plugin filters"
    mobileLabel="Plugin filters"
    class="registry-directory__filters-region"
  >
    <div class="registry-directory__filters">
      <div class="registry-directory__filters-header">
        <strong>Filters</strong>
        {#if activeFilterCount > 0}
          <button type="button" onclick={resetFilters}>Clear</button>
        {/if}
      </div>
      {@render filters()}
    </div>
  </AppShell.Body.Sidebar>

  <button
    type="button"
    class="registry-directory__resize-handle"
    data-resizing={resizePointerId === null ? undefined : ""}
    data-min-width={resizeMinimum}
    data-max-width={resizeMaximum}
    data-current-width={presentedFilterWidth}
    aria-label="Resize plugin filters panel"
    title="Drag to resize. Double-click to reset width."
    onpointerdown={beginResize}
    onpointermove={moveResize}
    onpointerup={finishResize}
    onpointercancel={finishResize}
    ondblclick={() => (filterWidth = undefined)}
    onkeydown={resizeWithKeyboard}
  >
    <span aria-hidden="true"></span>
  </button>

  <AppShell.Body.Content
    {...hoverScrollbarProps}
    label="Plugin directory results"
    class="registry-directory__results-region"
  >
    <section class="registry-directory__results">
      <header class="registry-directory__heading">
        <p aria-live="polite">{results.length} results</p>
        <div class="registry-directory__tools" aria-label="Result controls">
          <div class="registry-directory__view" aria-label="View mode">
            <Button
              type="button"
              size="sm"
              variant={directoryState.view === "list" ? "secondary" : "ghost"}
              aria-pressed={directoryState.view === "list"}
              onclick={() => replaceState({ view: "list" })}
            >
              <ListIcon data-icon="inline-start" aria-hidden="true" /> List
            </Button>
            <Button
              type="button"
              size="sm"
              variant={directoryState.view === "grid" ? "secondary" : "ghost"}
              aria-pressed={directoryState.view === "grid"}
              onclick={() => replaceState({ view: "grid" })}
            >
              <LayoutGridIcon data-icon="inline-start" aria-hidden="true" /> Cards
            </Button>
          </div>
          <label class="registry-directory__sort">
            <span class="sr-only">Sort plugins</span>
            <select
              value={directoryState.sort}
              onchange={(event) =>
                replaceState({
                  sort: event.currentTarget
                    .value as RegistryDirectoryState["sort"],
                })}
            >
              <option value="name">Name</option>
              <option value="new">New</option>
              <option value="updated">Recently updated</option>
              <option value="status">Status</option>
            </select>
          </label>
        </div>
      </header>

      <Input
        value={directoryState.query}
        aria-label="Search registry plugins"
        placeholder="Search plugins"
        oninput={(event) => replaceState({ query: event.currentTarget.value })}
      />

      {#if activeFilterCount > 0}
        <div
          class="registry-directory__active-filters"
          aria-label="Active filters"
        >
          {#each directoryState.categories as value}
            <button
              type="button"
              onclick={() => toggleListValue("categories", value)}
              >{titleCaseRegistryValue(value)}
              <XIcon aria-hidden="true" /></button
            >
          {/each}
          {#each directoryState.platforms as value}
            <button
              type="button"
              onclick={() => toggleListValue("platforms", value)}
              >{titleCaseRegistryValue(value)}
              <XIcon aria-hidden="true" /></button
            >
          {/each}
          {#each directoryState.statuses as value}
            <button
              type="button"
              onclick={() => toggleListValue("statuses", value)}
              >{registryStatusLabel(value)} <XIcon aria-hidden="true" /></button
            >
          {/each}
          {#if directoryState.officialOnly}
            <button
              type="button"
              onclick={() => replaceState({ officialOnly: false })}
              >Official <XIcon aria-hidden="true" /></button
            >
          {/if}
          <button type="button" class="clear" onclick={resetFilters}
            >Clear all</button
          >
        </div>
      {/if}

      {#if results.length === 0}
        <section class="registry-directory__empty">
          <PackageIcon aria-hidden="true" />
          <h2>No plugins match</h2>
          <p>Try changing the search or plugin filters.</p>
          <Button type="button" variant="outline" onclick={resetFilters}
            >Reset filters</Button
          >
        </section>
      {:else}
        <div class="registry-directory__list" data-view={directoryState.view}>
          {#each results as plugin (plugin.id)}
            <RegistryPluginCard
              {plugin}
              variant={directoryState.view === "grid" ? "card" : "list"}
              onOpen={onOpenPlugin}
            />
          {/each}
        </div>
      {/if}
    </section>
  </AppShell.Body.Content>
</AppShell.Body>

<style>
  :global(.registry-directory) {
    --ui-shell-body-sidebar-width: 14rem;
  }

  .registry-directory__filters {
    display: grid;
    align-content: start;
    min-height: 100%;
    padding: 0 0.65rem 2rem;
  }

  :global(.registry-directory__filters-region[data-side="left"]) {
    border-inline-end-color: transparent;
    background: var(--background);
  }

  .registry-directory__filters-header {
    position: sticky;
    z-index: 1;
    inset-block-start: 0;
    display: flex;
    min-height: var(--ui-shell-toolbar-height);
    align-items: center;
    justify-content: space-between;
    padding-inline: 0.5rem;
    background: var(--background);
  }

  .registry-directory__filters-header strong {
    font-size: 0.82rem;
  }

  .registry-directory__filters-header button {
    border: 0;
    padding: 0.25rem;
    color: var(--muted-foreground);
    background: transparent;
    font-size: 0.75rem;
    cursor: pointer;
  }

  .registry-directory__filters-header button:hover,
  .registry-directory__filters-header button:focus-visible {
    color: var(--foreground);
  }

  .registry-directory__filter-groups {
    display: grid;
    align-content: start;
    gap: 0.35rem;
  }

  :global(.registry-directory__group) {
    display: grid;
    padding-block-end: 0.2rem;
  }

  .registry-directory__filter-groups h2 {
    margin: 0;
  }

  :global(.registry-directory__group-trigger) {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    border: 0;
    border-radius: var(--radius);
    padding: 0.5rem;
    color: var(--muted-foreground);
    background: transparent;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-align: start;
    text-transform: uppercase;
    cursor: pointer;
  }

  :global(.registry-directory__group-trigger:hover),
  :global(.registry-directory__group-trigger:focus-visible) {
    color: var(--foreground);
    background: color-mix(in srgb, var(--accent) 60%, transparent);
    outline: none;
  }

  :global(.registry-directory__group-trigger svg) {
    width: 0.85rem;
    height: 0.85rem;
    transition: transform 120ms ease;
  }

  :global(.registry-directory__group-trigger[data-state="closed"] svg) {
    transform: rotate(-90deg);
  }

  :global(.registry-directory__group-content) {
    display: grid;
    gap: 0.2rem;
  }

  .registry-directory__filter,
  .registry-directory__show-more {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    border: 0;
    border-radius: var(--radius);
    padding: 0.42rem 0.5rem;
    color: var(--foreground);
    background: transparent;
    text-align: start;
    cursor: pointer;
  }

  .registry-directory__filter:hover,
  .registry-directory__filter:focus-visible,
  .registry-directory__filter.selected {
    background: color-mix(in srgb, var(--accent) 86%, transparent);
    outline: none;
  }

  .registry-directory__filter.selected {
    font-weight: 650;
  }

  .registry-directory__filter > span:first-child {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
  }

  .registry-directory__filter > span:last-child {
    color: var(--muted-foreground);
    font-size: 0.78rem;
  }

  .registry-directory__filter-icon {
    display: inline-grid;
    width: 1rem;
    height: 1rem;
    flex: none;
    place-items: center;
  }

  .registry-directory__filter-icon :global(svg) {
    width: 0.9rem;
    height: 0.9rem;
  }

  .registry-directory__show-more {
    color: var(--muted-foreground);
    font-size: 0.82rem;
  }

  .registry-directory__resize-handle {
    position: relative;
    z-index: 3;
    order: 0;
    width: 1px;
    flex: none;
    margin-inline-start: -1px;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: col-resize;
    touch-action: none;
  }

  .registry-directory__resize-handle > span {
    position: absolute;
    inset-block: 0;
    inset-inline-start: -0.25rem;
    width: 0.5rem;
  }

  .registry-directory__resize-handle > span::after {
    position: absolute;
    inset-block: 0;
    inset-inline-start: calc(50% - 0.5px);
    width: 1px;
    background: transparent;
    content: "";
    transition: background-color 120ms ease;
  }

  .registry-directory__resize-handle:hover > span::after,
  .registry-directory__resize-handle:focus-visible > span::after,
  .registry-directory__resize-handle[data-resizing] > span::after {
    background: var(--ring);
  }

  .registry-directory__resize-handle:focus-visible {
    outline: none;
  }

  .registry-directory__results {
    display: grid;
    align-content: start;
    gap: 1rem;
    width: min(100%, 78rem);
    min-width: 0;
    min-height: 100%;
    margin-inline: auto;
    padding: 1rem clamp(1.25rem, 4vw, 3rem) clamp(1.25rem, 4vw, 3rem);
    container: registry-results / inline-size;
  }

  :global(
      .registry-directory__results-region
        [data-ui-part="scroll-area-viewport"]
        > div
    ) {
    min-height: 100%;
  }

  .registry-directory__heading {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 1rem;
  }

  .registry-directory__heading p,
  .registry-directory__empty h2,
  .registry-directory__empty p {
    margin: 0;
  }

  .registry-directory__heading p,
  .registry-directory__empty p {
    color: var(--muted-foreground);
  }

  .registry-directory__tools,
  .registry-directory__view {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .registry-directory__sort select {
    height: 2.25rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding-inline: 0.65rem 1.75rem;
    color: var(--foreground);
    background: var(--background);
  }

  .registry-directory__active-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .registry-directory__active-filters button {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 0.3rem 0.55rem;
    color: var(--foreground);
    background: var(--muted);
    font-size: 0.78rem;
    cursor: pointer;
  }

  .registry-directory__active-filters button.clear {
    border-color: transparent;
    color: var(--muted-foreground);
    background: transparent;
  }

  .registry-directory__active-filters :global(svg) {
    width: 0.8rem;
  }

  .registry-directory__list {
    display: grid;
    gap: 0.75rem;
  }

  .registry-directory__list[data-view="grid"] {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .registry-directory__empty {
    display: grid;
    justify-items: center;
    gap: 0.6rem;
    border: 1px dashed var(--border);
    border-radius: calc(var(--radius) * 1.4);
    padding: 4rem 1rem;
    text-align: center;
  }

  .registry-directory__empty :global(svg) {
    width: 2rem;
    color: var(--muted-foreground);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
  }

  @media (max-width: 68rem) {
    .registry-directory__list[data-view="grid"] {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 42rem) {
    .registry-directory__heading {
      align-items: start;
      flex-direction: column;
    }

    .registry-directory__tools {
      width: 100%;
      justify-content: space-between;
    }

    .registry-directory__list[data-view="grid"] {
      grid-template-columns: 1fr;
    }
  }

  @container registry-results (max-width: 48rem) {
    .registry-directory__list[data-view="grid"] {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @container registry-results (max-width: 32rem) {
    .registry-directory__list[data-view="grid"] {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
