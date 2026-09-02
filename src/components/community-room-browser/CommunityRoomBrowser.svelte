<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import * as Tabs from "@lapismd/design-core/shadcn/tabs";
  import HashIcon from "@lucide/svelte/icons/hash";
  import MessagesSquareIcon from "@lucide/svelte/icons/messages-square";
  import PlusIcon from "@lucide/svelte/icons/plus";

  import type { CommunityRoomModel } from "../community-workspace/model.js";

  let {
    open = $bindable(false),
    rooms,
    initialKind = "all",
    canCreate = false,
    onSelect = () => {},
    onJoin = () => {},
    onCreate = () => {},
  }: {
    open?: boolean;
    rooms: readonly CommunityRoomModel[];
    initialKind?: "all" | "channel" | "forum";
    canCreate?: boolean;
    onSelect?: (room: CommunityRoomModel) => void;
    onJoin?: (room: CommunityRoomModel) => void;
    onCreate?: (kind: "channel" | "forum") => void;
  } = $props();
  let query = $state("");
  let membership = $state("all");
  let kind = $state<"all" | "channel" | "forum">("all");
  let sort = $state<"alphabetical" | "activity" | "members">("alphabetical");
  const filtered = $derived(
    rooms
      .filter((room) => kind === "all" || room.kind === kind)
      .filter((room) => membership === "all" || room.membership === "joined")
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
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="community-room-browser">
    <Dialog.Header>
      <Dialog.Title>Browse channels and forums</Dialog.Title>
      <Dialog.Description
        >Find public rooms, join them, or open them read-only.</Dialog.Description
      >
    </Dialog.Header>
    <div class="community-room-browser__controls">
      <Input
        bind:value={query}
        placeholder="Search rooms"
        aria-label="Search rooms"
      />
      <Tabs.Root bind:value={membership}>
        <Tabs.List aria-label="Room membership"
          ><Tabs.Trigger value="all">All</Tabs.Trigger><Tabs.Trigger
            value="joined">Joined</Tabs.Trigger
          ></Tabs.List
        >
      </Tabs.Root>
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
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onclick={() =>
            (sort =
              sort === "alphabetical"
                ? "activity"
                : sort === "activity"
                  ? "members"
                  : "alphabetical")}
          >Sort: {sort === "alphabetical"
            ? "A–Z"
            : sort === "activity"
              ? "activity"
              : "members"}</Button
        >
      </div>
    </div>
    <div class="community-room-browser__list">
      {#each filtered as room (room.id)}
        <div class="community-room-browser__room">
          {#if room.kind === "forum"}<MessagesSquareIcon
              aria-hidden="true"
            />{:else}<HashIcon aria-hidden="true" />{/if}
          <button type="button" onclick={() => onSelect(room)}
            ><strong>{room.name}</strong><small
              >{room.description ?? `${room.memberCount ?? 0} members`}</small
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
        <p class="community-room-browser__empty">No matching rooms</p>
      {/each}
    </div>
    {#if canCreate}
      <Dialog.Footer
        ><Button
          type="button"
          variant="outline"
          onclick={() => onCreate(kind === "forum" ? "forum" : "channel")}
          ><PlusIcon data-icon="inline-start" aria-hidden="true" />Create {kind ===
          "forum"
            ? "forum"
            : "channel"}</Button
        ></Dialog.Footer
      >
    {/if}
  </Dialog.Content>
</Dialog.Root>

<style>
  :global(.community-room-browser) {
    width: min(calc(100vw - 2rem), 42rem);
    max-height: min(44rem, calc(100vh - 2rem));
  }
  .community-room-browser__controls {
    display: grid;
    gap: 0.75rem;
  }
  .community-room-browser__filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
  .community-room-browser__list {
    display: grid;
    max-height: 24rem;
    overflow: auto;
  }
  .community-room-browser__room {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.75rem;
    padding: 0.65rem 0.25rem;
    border-block-end: 1px solid var(--border);
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
  .community-room-browser__room small,
  .community-room-browser__empty {
    color: var(--muted-foreground);
  }
</style>
