<script lang="ts">
  import "./CommunityNavigation.css";
  import { Badge } from "@lapismd/design-core/shadcn/badge";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Collapsible from "@lapismd/design-core/shadcn/collapsible";
  import * as DropdownMenu from "@lapismd/design-core/shadcn/dropdown-menu";
  import * as ContextMenu from "@lapismd/design-core/shadcn/context-menu";
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
  import FolderInputIcon from "@lucide/svelte/icons/folder-input";
  import FolderPlusIcon from "@lucide/svelte/icons/folder-plus";
  import ArchiveIcon from "@lucide/svelte/icons/archive";
  import BellOffIcon from "@lucide/svelte/icons/bell-off";
  import CircleDotIcon from "@lucide/svelte/icons/circle-dot";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import LogOutIcon from "@lucide/svelte/icons/log-out";
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import StarIcon from "@lucide/svelte/icons/star";
  import TrashIcon from "@lucide/svelte/icons/trash-2";
  import { type Component, type Snippet } from "svelte";
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import {
    type CommunityNavigationItemModel,
    type CommunityNavigationItemAction,
    type CommunityNavigationCustomSectionOption,
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
    onItemAction = () => {},
    customSections = [],
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
    onItemAction?: (
      item: CommunityNavigationItemModel,
      action: CommunityNavigationItemAction,
    ) => void;
    customSections?: readonly CommunityNavigationCustomSectionOption[];
    headerStart?: Snippet;
    headerEnd?: Snippet;
    footer?: Snippet;
  } = $props();

  let sectionOpen = $state<Record<string, boolean>>({});
  let sectionSort = $state<Record<string, CommunityNavigationSortOrder>>({});

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
    if (action.icon === "browse-channels") return HashIcon;
    if (action.icon === "browse-forums") return MessagesSquareIcon;
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
    if (compact) return true;
    return sectionOpen[section.id] ?? !section.initiallyCollapsed;
  }

  function setSectionOpen(sectionId: string, open: boolean): void {
    sectionOpen = { ...sectionOpen, [sectionId]: open };
  }

  function requestSearch(): void {
    onSearch("");
  }

  function handleShortcut(event: KeyboardEvent): void {
    if (
      (event.metaKey || event.ctrlKey) &&
      event.key.toLocaleLowerCase() === "k"
    ) {
      event.preventDefault();
      requestSearch();
    }
  }

  function hasRoomManagementActions(
    item: CommunityNavigationItemModel,
  ): boolean {
    return (
      item.settingsDisabled !== true ||
      item.leaveDisabled !== true ||
      item.archiveAvailable === true ||
      item.deleteDisabled !== true
    );
  }
</script>

{#snippet menuIcon(Icon?: Component)}
  <span class="lc-community-navigation__menu-icon-slot" aria-hidden="true">
    {#if Icon}<Icon />{/if}
  </span>
{/snippet}

{#snippet dropdownItemActions(item: CommunityNavigationItemModel)}
  <DropdownMenu.Group>
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger
        >{@render menuIcon(CopyIcon)}Copy</DropdownMenu.SubTrigger
      >
      <DropdownMenu.SubContent class="lc-community-navigation__submenu-content">
        <DropdownMenu.Group>
          <DropdownMenu.Item onSelect={() => onItemAction(item, "copy-name")}
            >{@render menuIcon()}{item.kind === "forum" ? "Forum" : "Channel"} name</DropdownMenu.Item
          >
          <DropdownMenu.Item onSelect={() => onItemAction(item, "copy-id")}
            >{@render menuIcon()}{item.kind === "forum" ? "Forum" : "Channel"} ID</DropdownMenu.Item
          >
        </DropdownMenu.Group>
      </DropdownMenu.SubContent>
    </DropdownMenu.Sub>
    {#if item.kind === "channel" || item.kind === "forum"}
      <DropdownMenu.Sub>
        <DropdownMenu.SubTrigger
          >{@render menuIcon(FolderInputIcon)}Move to section</DropdownMenu.SubTrigger
        >
        <DropdownMenu.SubContent
          class="lc-community-navigation__submenu-content"
        >
          <DropdownMenu.Group>
            <DropdownMenu.Item onSelect={() => onItemAction(item, "section:")}
              >{@render menuIcon(LayoutGridIcon)}No custom section</DropdownMenu.Item
            >
            {#each customSections as section (section.id)}<DropdownMenu.Item
                onSelect={() => onItemAction(item, `section:${section.id}`)}
                >{@render menuIcon(
                  FolderInputIcon,
                )}{section.label}</DropdownMenu.Item
              >{/each}
          </DropdownMenu.Group>
          <DropdownMenu.Separator />
          <DropdownMenu.Group>
            <DropdownMenu.Item
              onSelect={() => onItemAction(item, "create-section")}
              >{@render menuIcon(FolderPlusIcon)}Create new section</DropdownMenu.Item
            >
          </DropdownMenu.Group>
        </DropdownMenu.SubContent>
      </DropdownMenu.Sub>
    {/if}
  </DropdownMenu.Group>
  <DropdownMenu.Separator />
  <DropdownMenu.Group>
    <DropdownMenu.Item
      onSelect={() =>
        onItemAction(item, item.unreadCount ? "mark-read" : "mark-unread")}
      >{@render menuIcon(CircleDotIcon)}{item.unreadCount
        ? "Mark read"
        : "Mark unread"}</DropdownMenu.Item
    >
  </DropdownMenu.Group>
  <DropdownMenu.Separator />
  <DropdownMenu.Group>
    <DropdownMenu.Item
      onSelect={() => onItemAction(item, item.muted ? "unmute" : "mute")}
      >{@render menuIcon(BellOffIcon)}{item.muted
        ? "Unmute"
        : "Mute"}</DropdownMenu.Item
    >
    <DropdownMenu.Item
      onSelect={() => onItemAction(item, item.starred ? "unstar" : "star")}
      >{@render menuIcon(StarIcon)}{item.starred
        ? "Remove star"
        : "Star"}</DropdownMenu.Item
    >
  </DropdownMenu.Group>
  {#if item.kind !== "direct-message" && hasRoomManagementActions(item)}<DropdownMenu.Separator
    /><DropdownMenu.Group
      >{#if item.settingsDisabled !== true}<DropdownMenu.Item
          onSelect={() => onItemAction(item, "settings")}
          >{@render menuIcon(SettingsIcon)}Settings</DropdownMenu.Item
        >{/if}{#if item.leaveDisabled !== true}<DropdownMenu.Item
          variant="destructive"
          onSelect={() => onItemAction(item, "leave")}
          >{@render menuIcon(LogOutIcon)}Leave</DropdownMenu.Item
        >{/if}{#if item.archiveAvailable}<DropdownMenu.Item
          onSelect={() => onItemAction(item, "archive")}
          >{@render menuIcon(ArchiveIcon)}Archive</DropdownMenu.Item
        >{/if}{#if item.deleteDisabled !== true}<DropdownMenu.Item
          variant="destructive"
          onSelect={() => onItemAction(item, "delete")}
          >{@render menuIcon(TrashIcon)}Delete</DropdownMenu.Item
        >{/if}</DropdownMenu.Group
    >{/if}
{/snippet}

{#snippet contextItemActions(item: CommunityNavigationItemModel)}
  <ContextMenu.Group>
    <ContextMenu.Sub>
      <ContextMenu.SubTrigger
        >{@render menuIcon(CopyIcon)}Copy</ContextMenu.SubTrigger
      >
      <ContextMenu.SubContent class="lc-community-navigation__submenu-content">
        <ContextMenu.Group>
          <ContextMenu.Item onSelect={() => onItemAction(item, "copy-name")}
            >{@render menuIcon()}{item.kind === "forum" ? "Forum" : "Channel"} name</ContextMenu.Item
          >
          <ContextMenu.Item onSelect={() => onItemAction(item, "copy-id")}
            >{@render menuIcon()}{item.kind === "forum" ? "Forum" : "Channel"} ID</ContextMenu.Item
          >
        </ContextMenu.Group>
      </ContextMenu.SubContent>
    </ContextMenu.Sub>
    {#if item.kind === "channel" || item.kind === "forum"}
      <ContextMenu.Sub>
        <ContextMenu.SubTrigger
          >{@render menuIcon(FolderInputIcon)}Move to section</ContextMenu.SubTrigger
        >
        <ContextMenu.SubContent
          class="lc-community-navigation__submenu-content"
        >
          <ContextMenu.Group>
            <ContextMenu.Item onSelect={() => onItemAction(item, "section:")}
              >{@render menuIcon(LayoutGridIcon)}No custom section</ContextMenu.Item
            >
            {#each customSections as section (section.id)}<ContextMenu.Item
                onSelect={() => onItemAction(item, `section:${section.id}`)}
                >{@render menuIcon(
                  FolderInputIcon,
                )}{section.label}</ContextMenu.Item
              >{/each}
          </ContextMenu.Group>
          <ContextMenu.Separator />
          <ContextMenu.Group>
            <ContextMenu.Item
              onSelect={() => onItemAction(item, "create-section")}
              >{@render menuIcon(FolderPlusIcon)}Create new section</ContextMenu.Item
            >
          </ContextMenu.Group>
        </ContextMenu.SubContent>
      </ContextMenu.Sub>
    {/if}
  </ContextMenu.Group>
  <ContextMenu.Separator />
  <ContextMenu.Group>
    <ContextMenu.Item
      onSelect={() =>
        onItemAction(item, item.unreadCount ? "mark-read" : "mark-unread")}
      >{@render menuIcon(CircleDotIcon)}{item.unreadCount
        ? "Mark read"
        : "Mark unread"}</ContextMenu.Item
    >
  </ContextMenu.Group>
  <ContextMenu.Separator />
  <ContextMenu.Group>
    <ContextMenu.Item
      onSelect={() => onItemAction(item, item.muted ? "unmute" : "mute")}
      >{@render menuIcon(BellOffIcon)}{item.muted
        ? "Unmute"
        : "Mute"}</ContextMenu.Item
    >
    <ContextMenu.Item
      onSelect={() => onItemAction(item, item.starred ? "unstar" : "star")}
      >{@render menuIcon(StarIcon)}{item.starred
        ? "Remove star"
        : "Star"}</ContextMenu.Item
    >
  </ContextMenu.Group>
  {#if item.kind !== "direct-message" && hasRoomManagementActions(item)}<ContextMenu.Separator
    /><ContextMenu.Group
      >{#if item.settingsDisabled !== true}<ContextMenu.Item
          onSelect={() => onItemAction(item, "settings")}
          >{@render menuIcon(SettingsIcon)}Settings</ContextMenu.Item
        >{/if}{#if item.leaveDisabled !== true}<ContextMenu.Item
          variant="destructive"
          onSelect={() => onItemAction(item, "leave")}
          >{@render menuIcon(LogOutIcon)}Leave</ContextMenu.Item
        >{/if}{#if item.archiveAvailable}<ContextMenu.Item
          onSelect={() => onItemAction(item, "archive")}
          >{@render menuIcon(ArchiveIcon)}Archive</ContextMenu.Item
        >{/if}{#if item.deleteDisabled !== true}<ContextMenu.Item
          variant="destructive"
          onSelect={() => onItemAction(item, "delete")}
          >{@render menuIcon(TrashIcon)}Delete</ContextMenu.Item
        >{/if}</ContextMenu.Group
    >{/if}
{/snippet}

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
      onclick={requestSearch}
    >
      <SearchIcon aria-hidden="true" />
    </Button>
  {:else}
    <Button
      type="button"
      variant="ghost"
      class="lc-community-navigation__search-trigger"
      aria-label="Search community"
      onclick={requestSearch}
    >
      <SearchIcon aria-hidden="true" />
      <span>{model.searchPlaceholder ?? "Search everything"}</span>
      <kbd aria-hidden="true">⌘K</kbd>
    </Button>
  {/if}
  {@render headerEnd?.()}
</AppShell.Sidebar.Header>

<AppShell.Sidebar.Body class="lc-community-navigation__body">
  <nav aria-label="Community navigation" data-compact={compact || undefined}>
    <div class="lc-community-navigation__primary">
      {#each model.primaryItems as item (item.id)}
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

    {#each model.sections as section (section.id)}
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
                            {@render menuIcon(ActionIcon)}
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
                            {@render menuIcon(ArrowUpDownIcon)}
                            <span>Sort</span>
                          </DropdownMenu.SubTrigger>
                          <DropdownMenu.SubContent
                            class="lc-community-navigation__submenu-content"
                          >
                            <DropdownMenu.RadioGroup
                              value={sortFor(section.id)}
                              onValueChange={(value) =>
                                sortSection(section, value)}
                            >
                              <DropdownMenu.RadioItem value="alphabetical">
                                {@render menuIcon(ArrowDownAZIcon)}
                                <span>A - Z</span>
                              </DropdownMenu.RadioItem>
                              <DropdownMenu.RadioItem value="recent">
                                {@render menuIcon(Clock3Icon)}
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
              <div class="lc-community-navigation__item-row">
                <ContextMenu.Root>
                  <ContextMenu.Trigger>
                    <Button
                      variant="ghost"
                      size={compact ? "icon-sm" : "default"}
                      class="lc-community-navigation__item"
                      data-unread={item.unreadCount ? "" : undefined}
                      data-active={activeItemId === item.id ? "" : undefined}
                      aria-current={activeItemId === item.id
                        ? "page"
                        : undefined}
                      aria-label={item.label}
                      title={item.label}
                      onclick={() => onSelect(item)}
                    >
                      {#if item.kind === "direct-message" && item.member}
                        <CommunityMemberAvatar
                          member={item.member}
                          size="small"
                          showPresence
                          decorative
                        />
                      {:else}
                        <ItemIcon aria-hidden="true" />
                      {/if}
                      {#if !compact}<span>{item.label}</span>{/if}
                      {#if !compact && item.starred}<StarIcon
                          class="lc-community-navigation__state-icon"
                          aria-label="Starred"
                        />{/if}
                      {#if !compact && item.unreadCount}<Badge
                          variant="secondary">{item.unreadCount}</Badge
                        >{/if}
                    </Button>
                  </ContextMenu.Trigger>
                  <ContextMenu.Content
                    class="lc-community-navigation__item-menu-content"
                    >{@render contextItemActions(item)}</ContextMenu.Content
                  >
                </ContextMenu.Root>
                {#if !compact}
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger
                      >{#snippet child({ props })}<Button
                          {...props}
                          variant="ghost"
                          size="icon-sm"
                          class="lc-community-navigation__item-menu"
                          aria-label={`Open ${item.label} menu`}
                          ><EllipsisIcon aria-hidden="true" /></Button
                        >{/snippet}</DropdownMenu.Trigger
                    >
                    <DropdownMenu.Content
                      align="end"
                      class="lc-community-navigation__item-menu-content"
                      >{@render dropdownItemActions(item)}</DropdownMenu.Content
                    >
                  </DropdownMenu.Root>
                {/if}
              </div>
            {/each}
          </div>
        </Collapsible.Content>
      </Collapsible.Root>
    {/each}
  </nav>
</AppShell.Sidebar.Body>

{#if footer}
  <AppShell.Sidebar.Footer>
    {@render footer()}
  </AppShell.Sidebar.Footer>
{/if}
