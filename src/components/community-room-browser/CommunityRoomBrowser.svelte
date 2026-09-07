<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as Empty from "@lapismd/design-core/shadcn/empty";
  import * as InputGroup from "@lapismd/design-core/shadcn/input-group";
  import * as Tabs from "@lapismd/design-core/shadcn/tabs";
  import ArrowDownAZIcon from "@lucide/svelte/icons/arrow-down-a-z";
  import ArrowUpDownIcon from "@lucide/svelte/icons/arrow-up-down";
  import Clock3Icon from "@lucide/svelte/icons/clock-3";
  import HashIcon from "@lucide/svelte/icons/hash";
  import MessagesSquareIcon from "@lucide/svelte/icons/messages-square";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import SearchIcon from "@lucide/svelte/icons/search";

  import type { CommunityRoomModel } from "../community-workspace/model.js";

  let {
    open = $bindable(false),
    rooms,
    initialKind = "all",
    canCreate = false,
    onSelect,
    onJoin,
    onCreate,
  }: {
    open?: boolean;
    rooms: readonly CommunityRoomModel[];
    initialKind?: "all" | "channel" | "forum";
    canCreate?: boolean;
    onSelect: (room: CommunityRoomModel) => void;
    onJoin: (room: CommunityRoomModel) => void | Promise<void>;
    onCreate: (kind: "channel" | "forum") => void;
  } = $props();
  let query = $state("");
  let membership = $state<"all" | "joined" | "archived">("all");
  let kind = $state<"all" | "channel" | "forum">("all");
  let sort = $state<"alphabetical" | "activity" | "members">("alphabetical");
  const filtered = $derived(
    rooms
      .filter((room) => kind === "all" || room.kind === kind)
      .filter((room) =>
        membership === "archived"
          ? room.archived === true
          : room.archived !== true &&
            (membership === "all" || room.membership === "joined"),
      )
      .filter((room) =>
        `${room.name} ${room.description ?? ""}`
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase()),
      )
      .toSorted((a, b) =>
        sort === "members"
          ? (b.memberCount ?? 0) - (a.memberCount ?? 0)
          : sort === "activity"
            ? (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? "")
            : a.name.localeCompare(b.name),
      ),
  );

  $effect(() => {
    if (open) kind = initialKind;
  });

  const roomNoun = $derived(
    kind === "channel" ? "channel" : kind === "forum" ? "forum" : "room",
  );
  const roomNounPlural = $derived(`${roomNoun}s`);
  const sortLabel = $derived(
    sort === "alphabetical"
      ? "A to Z"
      : sort === "activity"
        ? "recent activity"
        : "member count",
  );

  function cycleSort(): void {
    sort =
      sort === "alphabetical"
        ? "activity"
        : sort === "activity"
          ? "members"
          : "alphabetical";
  }

  function roomSummary(room: CommunityRoomModel): string {
    const members = `${room.memberCount ?? 0} ${room.memberCount === 1 ? "member" : "members"}`;
    return room.description ? `${members} · ${room.description}` : members;
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="community-room-browser">
    <Dialog.Header>
      <Dialog.Title>Browse {roomNounPlural}</Dialog.Title>
      <Dialog.Description class="sr-only">
        Find public {roomNounPlural}, join them, or open them read-only.
      </Dialog.Description>
    </Dialog.Header>
    <div class="community-room-browser__controls">
      <InputGroup.Root class="community-room-browser__search">
        <InputGroup.Input
          bind:value={query}
          placeholder={`Search or create a ${roomNoun}`}
          aria-label={`Search ${roomNounPlural}`}
        />
        <InputGroup.Addon>
          <SearchIcon aria-hidden="true" />
        </InputGroup.Addon>
        <InputGroup.Addon align="inline-end">
          <InputGroup.Button
            size="icon-sm"
            aria-label={`Sort ${roomNounPlural} by ${sortLabel}`}
            title={`Sort by ${sortLabel}`}
            onclick={cycleSort}
          >
            {#if sort === "alphabetical"}
              <ArrowDownAZIcon aria-hidden="true" />
            {:else if sort === "activity"}
              <Clock3Icon aria-hidden="true" />
            {:else}
              <ArrowUpDownIcon aria-hidden="true" />
            {/if}
          </InputGroup.Button>
        </InputGroup.Addon>
      </InputGroup.Root>
      <Tabs.Root bind:value={membership}>
        <Tabs.List
          variant="line"
          class="community-room-browser__tabs"
          aria-label="Room membership"
        >
          <Tabs.Trigger value="all">All {roomNounPlural}</Tabs.Trigger>
          <Tabs.Trigger value="joined">Joined</Tabs.Trigger>
          <Tabs.Trigger value="archived">Archived</Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>
      {#if initialKind === "all"}
        <div class="community-room-browser__filters" aria-label="Room filters">
          {#each ["all", "channel", "forum"] as value}
            <Button
              type="button"
              size="sm"
              variant={kind === value ? "secondary" : "ghost"}
              onclick={() => (kind = value as typeof kind)}
              >{value === "all" ? "All types" : `${value}s`}</Button
            >
          {/each}
        </div>
      {/if}
    </div>
    {#if canCreate}
      <button
        type="button"
        class="community-room-browser__create"
        onclick={() => onCreate(kind === "forum" ? "forum" : "channel")}
      >
        <span><PlusIcon aria-hidden="true" /></span>
        Create a new {kind === "forum" ? "forum" : "channel"}
      </button>
    {/if}
    <div class="community-room-browser__list">
      {#each filtered as room (room.id)}
        <div class="community-room-browser__room">
          {#if room.kind === "forum"}<MessagesSquareIcon
              aria-hidden="true"
            />{:else}<HashIcon aria-hidden="true" />{/if}
          <button type="button" onclick={() => onSelect(room)}
            ><strong>{room.name}</strong><small>{roomSummary(room)}</small
            ></button
          >
          {#if room.membership !== "joined"}<Button
              type="button"
              size="sm"
              variant="outline"
              onclick={() => onJoin(room)}>Join</Button
            >{/if}
        </div>
      {:else}
        <Empty.Root class="community-room-browser__empty">
          <Empty.Header>
            <Empty.Media variant="icon"
              ><SearchIcon aria-hidden="true" /></Empty.Media
            >
            <Empty.Title role="heading" aria-level={2}>
              No matching rooms
            </Empty.Title>
            <Empty.Description>
              Try a different search or filter.
            </Empty.Description>
          </Empty.Header>
        </Empty.Root>
      {/each}
    </div>
  </Dialog.Content>
</Dialog.Root>

<style>
  :global(.community-room-browser) {
    width: min(calc(100vw - 2rem), 64rem);
    max-height: min(46rem, calc(100vh - 2rem));
    gap: 1rem;
    border-radius: 1.25rem;
    padding: clamp(1.25rem, 3vw, 2.25rem);
    box-shadow:
      0 2rem 5rem -1.25rem rgb(0 0 0 / 28%),
      0 0.75rem 2rem -1rem rgb(0 0 0 / 20%) !important;
    font-size: 1rem;
  }
  :global(.community-room-browser [data-ui-part="dialog-title"]) {
    font-size: 1.5rem;
    font-weight: 650;
  }
  :global([data-ui-part="dialog-overlay"]:has(+ .community-room-browser)) {
    background: color-mix(in srgb, var(--background) 68%, transparent);
    -webkit-backdrop-filter: blur(0.75rem);
    backdrop-filter: blur(0.75rem);
  }
  .community-room-browser__controls {
    display: grid;
    gap: 1rem;
  }
  :global(.community-room-browser__search[data-ui-part="input-group"]) {
    height: 3.25rem;
    border-radius: 0.8rem;
    background: color-mix(in srgb, var(--muted) 45%, transparent);
  }
  :global(.community-room-browser__search input) {
    font-size: 1rem;
  }
  :global(.community-room-browser__search svg) {
    width: 1.2rem;
    height: 1.2rem;
  }
  :global(.community-room-browser__tabs[data-ui-part="tabs-list"]) {
    width: 100%;
    justify-content: flex-start;
    gap: 1.75rem;
    border-bottom: 1px solid var(--border);
    border-radius: 0;
    padding-inline: 0;
  }
  :global(.community-room-browser__tabs [data-ui-part="tabs-trigger"]) {
    flex: none;
    border-radius: 0;
    padding-inline: 0;
    font-size: 0.9375rem;
  }
  :global(
      .community-room-browser__tabs
        [data-ui-part="tabs-trigger"][data-state="active"]
    ) {
    box-shadow: inset 0 -2px 0 var(--foreground);
  }
  .community-room-browser__filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  .community-room-browser__create {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 0.75rem;
    border: 1px solid var(--border);
    border-radius: 0.85rem;
    padding: 0.75rem 1rem;
    color: var(--foreground);
    background: color-mix(in srgb, var(--muted) 28%, transparent);
    font: inherit;
    font-weight: 550;
    text-align: start;
    cursor: pointer;
  }
  .community-room-browser__create:hover,
  .community-room-browser__create:focus-visible {
    background: color-mix(in srgb, var(--muted) 65%, transparent);
  }
  .community-room-browser__create > span {
    display: inline-flex;
    width: 2rem;
    height: 2rem;
    flex: none;
    align-items: center;
    justify-content: center;
    border-radius: 0.55rem;
    background: var(--muted);
  }
  .community-room-browser__create :global(svg) {
    width: 1rem;
    height: 1rem;
  }
  .community-room-browser__list {
    display: grid;
    max-height: 24rem;
    overflow: auto;
    border: 1px solid var(--border);
    border-radius: 0.85rem;
  }
  .community-room-browser__room {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.75rem;
    padding: 0.85rem 1rem;
    border-block-end: 1px solid var(--border);
  }
  .community-room-browser__room:last-child {
    border-block-end: 0;
  }
  .community-room-browser__room > button {
    display: grid;
    min-width: 0;
    border: 0;
    padding: 0;
    color: inherit;
    background: transparent;
    text-align: start;
    cursor: pointer;
  }
  .community-room-browser__room > button:hover strong {
    text-decoration: underline;
  }
  .community-room-browser__room small {
    color: var(--muted-foreground);
  }
  :global(.community-room-browser__empty) {
    padding: 1.5rem;
  }

  @media (max-width: 40rem) {
    :global(.community-room-browser) {
      max-width: calc(100% - 1rem);
      max-height: calc(100vh - 1rem);
      padding: 1.125rem;
    }
    :global(.community-room-browser__tabs[data-ui-part="tabs-list"]) {
      gap: 1rem;
    }
    .community-room-browser__filters {
      overflow-x: auto;
      flex-wrap: nowrap;
    }
    .community-room-browser__room {
      padding-inline: 0.75rem;
    }
  }
</style>
