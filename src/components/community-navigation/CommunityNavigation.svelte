<script lang="ts">
  import "./CommunityNavigation.css";
  import { SearchFilterBar } from "@lapismd/design-core/filter";
  import { Badge } from "@lapismd/design-core/shadcn/badge";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Collapsible from "@lapismd/design-core/shadcn/collapsible";
  import * as DropdownMenu from "@lapismd/design-core/shadcn/dropdown-menu";
  import { AppShell } from "@lapismd/design-core/shell";
  import ArrowDownAZIcon from "@lucide/svelte/icons/arrow-down-a-z";
  import ArrowUpDownIcon from "@lucide/svelte/icons/arrow-up-down";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import CircleUserRoundIcon from "@lucide/svelte/icons/circle-user-round";
  import Clock3Icon from "@lucide/svelte/icons/clock-3";
  import CompassIcon from "@lucide/svelte/icons/compass";
  import EllipsisIcon from "@lucide/svelte/icons/ellipsis";
  import HashIcon from "@lucide/svelte/icons/hash";
  import InboxIcon from "@lucide/svelte/icons/inbox";
  import LayoutGridIcon from "@lucide/svelte/icons/layout-grid";
  import LockKeyholeIcon from "@lucide/svelte/icons/lock-keyhole";
  import MessageSquarePlusIcon from "@lucide/svelte/icons/message-square-plus";
  import MessagesSquareIcon from "@lucide/svelte/icons/messages-square";
  import PackageSearchIcon from "@lucide/svelte/icons/package-search";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import SearchIcon from "@lucide/svelte/icons/search";
  import { tick, type Component, type Snippet } from "svelte";
  import {
    filterCommunityNavigation,
    type CommunityNavigationItemModel,
    type CommunityNavigationModel,
    type CommunityNavigationSectionActionModel,
    type CommunityNavigationSectionModel,
    type CommunityNavigationSortOrder,
  } from "./model.js";

  let {
    model,
    activeItemId,
    compact = false,
    onSelect = () => {},
    onSearch = () => {},
    onSectionAction = () => {},
    onRequestExpand = () => {},
    headerStart,
    headerEnd,
    footer,
  }: {
    model: CommunityNavigationModel;
    activeItemId?: string;
    compact?: boolean;
    onSelect?: (item: CommunityNavigationItemModel) => void;
    onSearch?: (query: string) => void;
    onSectionAction?: (
      section: CommunityNavigationSectionModel,
      action: CommunityNavigationSectionActionModel,
    ) => void;
    onRequestExpand?: () => void;
    headerStart?: Snippet;
    headerEnd?: Snippet;
    footer?: Snippet;
  } = $props();

  let query = $state("");
  let search = $state<{ focus: () => void } | null>(null);
  let sectionOpen = $state<Record<string, boolean>>({});
  let sectionSort = $state<Record<string, CommunityNavigationSortOrder>>({});
  let filteredModel = $derived(filterCommunityNavigation(model, query));

  function iconFor(item: CommunityNavigationItemModel): Component {
    if (item.restricted) return LockKeyholeIcon;
    if (item.kind === "inbox") return InboxIcon;
    if (item.icon === "package-search") return PackageSearchIcon;
    if (item.kind === "channel") return HashIcon;
    if (item.kind === "forum") return MessagesSquareIcon;
    if (item.kind === "direct-message") return CircleUserRoundIcon;
    return LayoutGridIcon;
  }

  function iconForAction(
    action: CommunityNavigationSectionActionModel,
  ): Component {
    if (action.icon === "browse") return CompassIcon;
    if (action.icon === "compose") return MessageSquarePlusIcon;
    return LayoutGridIcon;
  }

  function sortFor(sectionId: string): CommunityNavigationSortOrder {
    return sectionSort[sectionId] ?? "recent";
  }

  function sortSection(
    section: CommunityNavigationSectionModel,
    order: string,
  ): void {
    if (order !== "alphabetical" && order !== "recent") return;
    sectionSort = { ...sectionSort, [section.id]: order };
  }

  function sortedItems(
    section: CommunityNavigationSectionModel,
  ): readonly CommunityNavigationItemModel[] {
    const items = [...section.items];
    if (sortFor(section.id) === "alphabetical") {
      return items.sort((left, right) =>
        left.label.localeCompare(right.label, undefined, {
          sensitivity: "base",
        }),
      );
    }
    return items.sort((left, right) =>
      (right.activityAt ?? "").localeCompare(left.activityAt ?? ""),
    );
  }

  function isSectionOpen(section: CommunityNavigationSectionModel): boolean {
    if (compact || query.length > 0) return true;
    return sectionOpen[section.id] ?? !section.initiallyCollapsed;
  }

  function setSectionOpen(sectionId: string, open: boolean): void {
    sectionOpen = { ...sectionOpen, [sectionId]: open };
  }

  function setQuery(value: string): void {
    query = value;
    onSearch(value);
  }

  async function handleShortcut(event: KeyboardEvent): Promise<void> {
    if (
      (event.metaKey || event.ctrlKey) &&
      event.key.toLocaleLowerCase() === "k"
    ) {
      event.preventDefault();
      if (compact) {
        onRequestExpand();
        await tick();
        search?.focus();
      } else {
        search?.focus();
      }
    }
  }
</script>

<svelte:window onkeydown={handleShortcut} />

<AppShell.Sidebar.Header class="lc-community-navigation__header">
  {@render headerStart?.()}
  {#if compact}
    <Button
      variant="ghost"
      size="icon-sm"
      class="lc-community-navigation__compact-search"
      aria-label="Search community"
      title="Search community"
      onclick={onRequestExpand}
    >
      <SearchIcon aria-hidden="true" />
    </Button>
  {:else}
    <SearchFilterBar
      bind:this={search}
      value={query}
      inputMode="plain"
      placeholder={model.searchPlaceholder ?? "Search everything"}
      ariaLabel="Search community"
      shortcut="⌘K"
      onValueChange={setQuery}
      onClearSearch={() => setQuery("")}
    />
  {/if}
  {@render headerEnd?.()}
</AppShell.Sidebar.Header>

<AppShell.Sidebar.Body class="lc-community-navigation__body">
  <nav aria-label="Community navigation" data-compact={compact || undefined}>
    <div class="lc-community-navigation__primary">
      {#each filteredModel.primaryItems as item (item.id)}
        {@const ItemIcon = iconFor(item)}
        <Button
          variant="ghost"
          size={compact ? "icon-sm" : "default"}
          class="lc-community-navigation__item"
          data-active={activeItemId === item.id ? "" : undefined}
          aria-current={activeItemId === item.id ? "page" : undefined}
          aria-label={item.label}
          title={item.label}
          onclick={() => onSelect(item)}
        >
          <ItemIcon aria-hidden="true" />
          {#if !compact}<span>{item.label}</span>{/if}
          {#if !compact && item.unreadCount}
            <Badge variant="secondary">{item.unreadCount}</Badge>
          {/if}
        </Button>
      {/each}
    </div>

    {#each filteredModel.sections as section (section.id)}
      <Collapsible.Root
        class="lc-community-navigation__section"
        open={isSectionOpen(section)}
        onOpenChange={(open) => setSectionOpen(section.id, open)}
      >
        {#if !compact}
          <div class="lc-community-navigation__section-header">
            <h2>
              <Collapsible.Trigger
                class="lc-community-navigation__section-trigger"
                title={`Toggle ${section.label}`}
              >
                <ChevronRightIcon aria-hidden="true" />
                <span>{section.label}</span>
              </Collapsible.Trigger>
            </h2>
            <div class="lc-community-navigation__section-actions">
              {#if section.primaryAction}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  class="lc-community-navigation__section-action"
                  aria-label={section.primaryAction.label}
                  title={section.primaryAction.label}
                  onclick={() =>
                    onSectionAction(section, section.primaryAction!)}
                >
                  <PlusIcon data-icon="inline-start" aria-hidden="true" />
                </Button>
              {/if}
              {#if section.actions?.length || section.sortable}
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger>
                    {#snippet child({ props })}
                      <Button
                        {...props}
                        variant="ghost"
                        size="icon-sm"
                        class="lc-community-navigation__section-menu"
                        aria-label={`Open ${section.label} menu`}
                        title={`${section.label} actions`}
                      >
                        <EllipsisIcon aria-hidden="true" />
                      </Button>
                    {/snippet}
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={4}
                    class="lc-community-navigation__section-menu-content"
                  >
                    {#if section.actions?.length}
                      <DropdownMenu.Group>
                        {#each section.actions as action (action.id)}
                          {@const ActionIcon = iconForAction(action)}
                          <DropdownMenu.Item
                            onSelect={() => onSectionAction(section, action)}
                          >
                            <ActionIcon
                              class="lc-community-navigation__menu-item-icon"
                              aria-hidden="true"
                            />
                            <span>{action.label}</span>
                          </DropdownMenu.Item>
                        {/each}
                      </DropdownMenu.Group>
                    {/if}
                    {#if section.actions?.length && section.sortable}
                      <DropdownMenu.Separator />
                    {/if}
                    {#if section.sortable}
                      <DropdownMenu.Group>
                        <DropdownMenu.Sub>
                          <DropdownMenu.SubTrigger>
                            <ArrowUpDownIcon
                              class="lc-community-navigation__menu-item-icon"
                              aria-hidden="true"
                            />
                            <span>Sort</span>
                          </DropdownMenu.SubTrigger>
                          <DropdownMenu.SubContent>
                            <DropdownMenu.RadioGroup
                              value={sortFor(section.id)}
                              onValueChange={(value) =>
                                sortSection(section, value)}
                            >
                              <DropdownMenu.RadioItem value="alphabetical">
                                <ArrowDownAZIcon
                                  class="lc-community-navigation__menu-item-icon"
                                  aria-hidden="true"
                                />
                                <span>A - Z</span>
                              </DropdownMenu.RadioItem>
                              <DropdownMenu.RadioItem value="recent">
                                <Clock3Icon
                                  class="lc-community-navigation__menu-item-icon"
                                  aria-hidden="true"
                                />
                                <span>Recent</span>
                              </DropdownMenu.RadioItem>
                            </DropdownMenu.RadioGroup>
                          </DropdownMenu.SubContent>
                        </DropdownMenu.Sub>
                      </DropdownMenu.Group>
                    {/if}
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              {/if}
            </div>
          </div>
        {/if}
        <Collapsible.Content>
          <div class="lc-community-navigation__items">
            {#each sortedItems(section) as item (item.id)}
              {@const ItemIcon = iconFor(item)}
              <Button
                variant="ghost"
                size={compact ? "icon-sm" : "default"}
                class="lc-community-navigation__item"
                data-active={activeItemId === item.id ? "" : undefined}
                aria-current={activeItemId === item.id ? "page" : undefined}
                aria-label={item.label}
                title={item.label}
                onclick={() => onSelect(item)}
              >
                <ItemIcon aria-hidden="true" />
                {#if !compact}<span>{item.label}</span>{/if}
                {#if !compact && item.unreadCount}
                  <Badge variant="secondary">{item.unreadCount}</Badge>
                {/if}
              </Button>
            {/each}
          </div>
        </Collapsible.Content>
      </Collapsible.Root>
    {/each}

    {#if query && filteredModel.primaryItems.length === 0 && filteredModel.sections.length === 0}
      <p class="lc-community-navigation__empty">No matching rooms</p>
    {/if}
  </nav>
</AppShell.Sidebar.Body>

{#if footer}
  <AppShell.Sidebar.Footer>
    {@render footer()}
  </AppShell.Sidebar.Footer>
{/if}
