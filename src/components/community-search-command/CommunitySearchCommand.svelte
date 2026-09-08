<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Command from "@lapismd/design-core/shadcn/command";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import CircleUserRoundIcon from "@lucide/svelte/icons/circle-user-round";
  import HashIcon from "@lucide/svelte/icons/hash";
  import ListFilterIcon from "@lucide/svelte/icons/list-filter";
  import MessageSquareIcon from "@lucide/svelte/icons/message-square";
  import MessagesSquareIcon from "@lucide/svelte/icons/messages-square";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import SearchIcon from "@lucide/svelte/icons/search";
  import UserIcon from "@lucide/svelte/icons/user";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import type {
    CommunityMemberModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";
  import type { CommunitySearchMessageModel } from "./model.js";
  let {
    open = $bindable(false),
    query = "",
    rooms = [],
    messages = [],
    members = [],
    scopeRoom,
    canCreateChannel = false,
    updating = false,
    onQueryChange,
    onSelectRoom,
    onSelectMessage,
    onSelectMember,
    onBrowseChannels,
    onCreateChannel,
  }: {
    open?: boolean;
    query?: string;
    rooms?: readonly CommunityRoomModel[];
    messages?: readonly CommunitySearchMessageModel[];
    members?: readonly CommunityMemberModel[];
    scopeRoom?: CommunityRoomModel;
    canCreateChannel?: boolean;
    updating?: boolean;
    onQueryChange: (query: string) => void;
    onSelectRoom: (room: CommunityRoomModel) => void;
    onSelectMessage: (message: CommunitySearchMessageModel) => void;
    onSelectMember: (member: CommunityMemberModel) => void;
    onBrowseChannels: () => void;
    onCreateChannel: () => void;
  } = $props();

  let scopedRoomId = $state("");
  const scoped = $derived(
    scopeRoom !== undefined && scopeRoom.id === scopedRoomId,
  );
  const searchTitle = $derived(
    scoped && scopeRoom ? `Search in #${scopeRoom.name}` : "Search community",
  );
  const scopedMessages = $derived(
    scoped && scopeRoom
      ? messages.filter((message) => message.roomId === scopeRoom.id)
      : messages,
  );
  const scopeInputPadding = $derived(
    scoped && scopeRoom
      ? `${Math.min(scopeRoom.name.length, 24) * 0.45 + 2.8}rem`
      : undefined,
  );

  $effect(() => {
    if (!open || scopeRoom === undefined) scopedRoomId = "";
  });

  function selectScope(): void {
    if (scopeRoom === undefined) return;
    scopedRoomId = scopeRoom.id;
    onQueryChange("");
  }

  function clearScope(): void {
    scopedRoomId = "";
  }

  function roomDescription(room: CommunityRoomModel): string {
    if (room.description) return room.description;
    if (room.kind === "direct") return "Direct message";
    return `${room.memberCount ?? 0} ${room.memberCount === 1 ? "member" : "members"}`;
  }

  function messageDescription(message: CommunitySearchMessageModel): string {
    const room = rooms.find((candidate) => candidate.id === message.roomId);
    return room === undefined
      ? message.timestamp
      : `${room.name} · ${message.timestamp}`;
  }
</script>

<Command.Dialog
  bind:open
  class="community-search-command"
  title={searchTitle}
  description={scoped && scopeRoom
    ? `Search messages in #${scopeRoom.name}. The relay is queried when it supports NIP-50.`
    : "Search rooms, loaded messages, and known members. The relay is queried when it supports NIP-50."}
>
  <div
    class="community-search-command__input-row"
    data-scoped={scoped ? "" : undefined}
    style:--community-search-scope-padding={scopeInputPadding}
  >
    <Command.Input
      class="community-search-command__input"
      value={query}
      placeholder={scoped
        ? "Search messages"
        : "Search for a channel, message, or person"}
      aria-label={searchTitle}
      aria-controls="community-search-command-results"
      oninput={(event) => onQueryChange(event.currentTarget.value)}
    />
    {#if scoped && scopeRoom}
      <CommunityChip
        variant="muted"
        class="community-search-command__scope"
        ariaLabel={`Remove #${scopeRoom.name} search scope`}
        onclick={clearScope}
      >
        #{scopeRoom.name}
        <span aria-hidden="true">×</span>
      </CommunityChip>
    {/if}
    <Dialog.Close>
      {#snippet child({ props })}
        <Button
          {...props}
          variant="outline"
          size="sm"
          class="community-search-command__escape"
          aria-label="Close search"
          title="Close search">Esc</Button
        >
      {/snippet}
    </Dialog.Close>
  </div>
  {#if updating}
    <p class="community-search-command__sync-status" role="status">
      Updating older community results…
    </p>
  {/if}
  <Command.List id="community-search-command-results">
    {#if !scoped && scopeRoom}
      <Command.Group>
        <Command.Item
          value={`Search in #${scopeRoom.name}`}
          onSelect={selectScope}
        >
          <SearchIcon aria-hidden="true" />
          <span class="community-search-command__result-copy">
            <strong>Search in #{scopeRoom.name}</strong>
            <small>Search messages in this channel</small>
          </span>
        </Command.Item>
      </Command.Group>
    {/if}
    {#if scoped}
      {#if query.trim()}
        <Command.Empty>No matching messages in #{scopeRoom?.name}</Command.Empty
        >
        {#if scopedMessages.length}
          <Command.Group heading="Search results">
            {#each scopedMessages as message (message.id)}
              <Command.Item
                value={`${message.content} ${message.timestamp}`}
                onSelect={() => onSelectMessage(message)}
              >
                <MessageSquareIcon aria-hidden="true" />
                <span class="community-search-command__result-copy">
                  <strong>{message.content.slice(0, 100)}</strong>
                  <small>{message.timestamp}</small>
                </span>
              </Command.Item>
            {/each}
          </Command.Group>
        {/if}
      {/if}
    {:else}
      <Command.Empty>No matching channels, messages, or people</Command.Empty>
      {#if rooms.length || messages.length || members.length}
        <Command.Group
          heading={query.trim() ? "Search results" : "Recent activity"}
        >
          {#each rooms as room (room.id)}
            <Command.Item
              value={`${room.name} ${room.description ?? ""}`}
              onSelect={() => onSelectRoom(room)}
            >
              {#if room.kind === "forum"}
                <MessagesSquareIcon aria-hidden="true" />
              {:else if room.kind === "direct"}
                <CircleUserRoundIcon aria-hidden="true" />
              {:else}
                <HashIcon aria-hidden="true" />
              {/if}
              <span class="community-search-command__result-copy">
                <strong>{room.name}</strong>
                <small>{roomDescription(room)}</small>
              </span>
            </Command.Item>
          {/each}
          {#each messages as message (message.id)}
            <Command.Item
              value={`${message.content} ${messageDescription(message)}`}
              onSelect={() => onSelectMessage(message)}
            >
              <MessageSquareIcon aria-hidden="true" />
              <span class="community-search-command__result-copy">
                <strong>{message.content.slice(0, 100)}</strong>
                <small>{messageDescription(message)}</small>
              </span>
            </Command.Item>
          {/each}
          {#each members as member (member.id)}
            <Command.Item
              value={`${member.name} ${member.handle}`}
              onSelect={() => onSelectMember(member)}
            >
              <UserIcon aria-hidden="true" />
              <span class="community-search-command__result-copy">
                <strong>{member.name}</strong>
                <small>@{member.handle}</small>
              </span>
            </Command.Item>
          {/each}
        </Command.Group>
      {/if}
      <Command.Group heading="Actions">
        <Command.Item value="Browse channels" onSelect={onBrowseChannels}>
          <ListFilterIcon aria-hidden="true" />
          <span class="community-search-command__result-copy">
            <strong>Browse channels</strong>
          </span>
        </Command.Item>
        {#if canCreateChannel}
          <Command.Item value="Create a new channel" onSelect={onCreateChannel}>
            <PlusIcon aria-hidden="true" />
            <span class="community-search-command__result-copy">
              <strong>Create a new channel</strong>
            </span>
          </Command.Item>
        {/if}
      </Command.Group>
    {/if}
  </Command.List>
</Command.Dialog>

<style>
  :global(.community-search-command) {
    top: clamp(2rem, 10vh, 8rem);
    width: min(calc(100vw - 2rem), 64rem);
    max-width: min(calc(100vw - 2rem), 64rem) !important;
    max-height: min(48rem, calc(100vh - 4rem));
    translate: -50% 0;
    border-radius: 1.25rem !important;
    box-shadow:
      0 2rem 5rem -1.25rem rgb(0 0 0 / 32%),
      0 0.75rem 2rem -1rem rgb(0 0 0 / 24%) !important;
    font-size: 1rem;
  }
  :global([data-ui-part="dialog-overlay"]:has(+ .community-search-command)) {
    background: color-mix(in srgb, var(--background) 68%, transparent);
    -webkit-backdrop-filter: blur(0.75rem);
    backdrop-filter: blur(0.75rem);
  }
  :global(.community-search-command [data-ui-part="command"]) {
    padding: 0;
  }
  .community-search-command__input-row {
    --ui-input-group-focus-ring-color: transparent;

    display: flex;
    align-items: center;
    gap: 1rem;
    border-block-end: 1px solid var(--border);
    padding: 1.15rem 1.5rem;
    position: relative;
  }
  :global(
      .community-search-command__input-row
        [data-ui-part="command-input-wrapper"]
    ) {
    min-width: 0;
    flex: 1;
    padding: 0;
    outline: 0 !important;
    box-shadow: none !important;
  }
  :global(
      .community-search-command__input-row
        [data-ui-part="command-input-wrapper"]
        > [data-ui-component="input-group"][data-ui-part="input-group"]
    ) {
    height: 2.75rem !important;
    border: 0 !important;
    outline: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    --tw-ring-color: transparent !important;
    --tw-ring-shadow: 0 0 #0000 !important;
  }
  :global(
      .community-search-command__input-row
        [data-ui-part="command-input-wrapper"]
        > [data-ui-component="input-group"][data-ui-part="input-group"]:focus-within
    ),
  :global(
      .community-search-command__input-row
        [data-slot="input-group-control"]:focus-visible
    ) {
    border-color: transparent !important;
    outline: 0 !important;
    box-shadow: none !important;
    --tw-ring-color: transparent !important;
    --tw-ring-shadow: 0 0 #0000 !important;
  }
  :global(.community-search-command__input[data-slot="input-group-control"]) {
    border: 0 !important;
    outline: 0 !important;
    box-shadow: none !important;
    --tw-ring-color: transparent !important;
    --tw-ring-shadow: 0 0 #0000 !important;
  }
  :global(
      .community-search-command__input-row[data-scoped]
        .community-search-command__input[data-slot="input-group-control"]
    ) {
    padding-inline-start: var(--community-search-scope-padding, 6rem);
  }
  :global(.community-search-command__scope[data-ui-part="community-chip"]) {
    position: absolute;
    z-index: 1;
    left: 3.75rem;
  }
  :global(
      .community-search-command__input-row [data-slot="input-group-control"]
    ) {
    font-size: 1.2rem;
  }
  :global(
      .community-search-command__input-row [data-ui-part="command-search-icon"]
    ) {
    width: 1.4rem;
    height: 1.4rem;
    opacity: 1;
  }
  :global(.community-search-command__escape[data-ui-component="button"]) {
    height: 2rem;
    border-radius: 0.45rem;
    padding-inline: 0.65rem;
    color: var(--muted-foreground);
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
  }
  :global(.community-search-command [data-ui-part="command-list"]) {
    max-height: min(39rem, calc(100vh - 9.5rem));
    padding: 0.75rem;
  }
  .community-search-command__sync-status {
    margin: 0 0.5rem 0.35rem;
    color: var(--muted-foreground);
    font-size: 0.8rem;
  }
  :global(.community-search-command [data-ui-part="command-group"]) {
    padding: 0.25rem 0;
  }
  :global(.community-search-command [data-ui-part="command-group-heading"]) {
    padding: 0.75rem 0.5rem 0.5rem;
    font-size: 0.95rem;
    font-weight: 500;
  }
  :global(.community-search-command [data-ui-part="command-item"]) {
    min-height: 3.75rem;
    gap: 1rem;
    border-radius: 0.8rem !important;
    padding: 0.65rem 0.75rem;
    font-size: 1rem;
  }
  :global(.community-search-command [data-ui-part="command-item"] > svg) {
    width: 1.4rem;
    height: 1.4rem;
    color: var(--foreground);
  }
  .community-search-command__result-copy {
    display: grid;
    min-width: 0;
    gap: 0.15rem;
  }
  .community-search-command__result-copy strong,
  .community-search-command__result-copy small {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .community-search-command__result-copy strong {
    font-weight: 600;
  }
  .community-search-command__result-copy small {
    color: var(--muted-foreground);
    font-size: 0.9rem;
    font-weight: 400;
  }

  @media (max-width: 40rem) {
    :global(.community-search-command) {
      top: 0.5rem;
      width: calc(100vw - 1rem);
      max-width: calc(100vw - 1rem) !important;
      max-height: calc(100vh - 1rem);
    }
    .community-search-command__input-row {
      padding-inline: 1rem;
    }
    :global(
        .community-search-command__input-row [data-slot="input-group-control"]
      ) {
      font-size: 1rem;
    }
    :global(.community-search-command [data-ui-part="command-list"]) {
      max-height: calc(100vh - 6rem);
    }
  }
</style>
