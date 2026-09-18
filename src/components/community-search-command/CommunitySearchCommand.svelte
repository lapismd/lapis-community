<script lang="ts">
  import CommunityProjectChannelIcon from "../community-project-channel-icon/CommunityProjectChannelIcon.svelte";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as CommandView from "@lapismd/design-core/shadcn/command-view";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import BotIcon from "@lucide/svelte/icons/bot";
  import CircleUserRoundIcon from "@lucide/svelte/icons/circle-user-round";
  import FolderGit2Icon from "@lucide/svelte/icons/folder-git-2";
  import HashIcon from "@lucide/svelte/icons/hash";
  import MessagesSquareIcon from "@lucide/svelte/icons/messages-square";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import SearchIcon from "@lucide/svelte/icons/search";
  import UserIcon from "@lucide/svelte/icons/user";
  import { tick } from "svelte";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import { communityMemberHandleLabel } from "../community-member-avatar/handle.js";
  import { formatCommunityRelativeTime } from "../community-relative-time/model.js";
  import type {
    CommunityMemberModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";
  import type {
    CommunitySearchMessageModel,
    CommunitySearchScope,
  } from "./model.js";

  const RECENT_ACTIVITY_LIMIT = 4;
  let {
    open = $bindable(false),
    query = "",
    rooms = [],
    messages = [],
    members = [],
    authors = [],
    scope,
    scopeRoom,
    canCreateChannel = false,
    onQueryChange,
    onSelectRoom,
    onSelectMessage,
    onSelectMember,
    onBrowseChannels,
    onCreateChannel,
    onCreateAgent,
  }: {
    open?: boolean;
    query?: string;
    rooms?: readonly CommunityRoomModel[];
    messages?: readonly CommunitySearchMessageModel[];
    members?: readonly CommunityMemberModel[];
    authors?: readonly CommunityMemberModel[];
    scope?: CommunitySearchScope;
    /** @deprecated Use scope. Kept for compatibility with existing hosts. */
    scopeRoom?: CommunityRoomModel;
    canCreateChannel?: boolean;
    onQueryChange: (query: string) => void;
    onSelectRoom: (room: CommunityRoomModel) => void;
    onSelectMessage: (message: CommunitySearchMessageModel) => void;
    onSelectMember: (member: CommunityMemberModel) => void;
    onBrowseChannels: () => void;
    onCreateChannel: () => void;
    onCreateAgent?: () => void;
  } = $props();

  const availableScope = $derived.by((): CommunitySearchScope | undefined => {
    if (scope !== undefined) return scope;
    if (scopeRoom === undefined) return undefined;
    return {
      id: `room:${scopeRoom.id}`,
      kind: scopeRoom.kind === "direct" ? "conversation" : scopeRoom.kind,
      label:
        scopeRoom.kind === "direct" ? scopeRoom.name : `#${scopeRoom.name}`,
      roomIds: [scopeRoom.id, scopeRoom.groupId].filter(
        (value): value is string => value !== undefined && value !== "",
      ),
    };
  });
  let activeScopeId = $state("");
  let selectedCommandValue = $state("");
  let searchInput = $state<HTMLInputElement | null>(null);
  const scoped = $derived(
    availableScope !== undefined && availableScope.id === activeScopeId,
  );
  const searchTitle = $derived(
    scoped && availableScope
      ? `Search in ${availableScope.label}`
      : "Search community",
  );
  const scopedMessages = $derived(
    scoped && availableScope
      ? messages.filter(
          (message) =>
            message.roomId !== undefined &&
            availableScope.roomIds.includes(message.roomId),
        )
      : messages,
  );
  const recentRooms = $derived.by(() =>
    [...rooms]
      .filter((room) => room.archived !== true)
      .sort((left, right) => {
        const activityDifference =
          Date.parse(right.lastActivityAt ?? "") -
          Date.parse(left.lastActivityAt ?? "");
        if (Number.isFinite(activityDifference) && activityDifference !== 0)
          return activityDifference;
        const kindRank = (room: CommunityRoomModel): number =>
          room.kind === "direct" ? 0 : room.kind === "channel" ? 1 : 2;
        return kindRank(left) - kindRank(right);
      })
      .slice(0, RECENT_ACTIVITY_LIMIT),
  );
  const visibleRooms = $derived(query.trim() ? rooms : recentRooms);
  const visibleMessages = $derived(query.trim() ? messages : []);
  const visibleMembers = $derived(query.trim() ? members : []);
  $effect(() => {
    if (!open || availableScope === undefined) activeScopeId = "";
  });

  async function selectScope(): Promise<void> {
    if (availableScope === undefined) return;
    selectedCommandValue = "";
    activeScopeId = availableScope.id;
    onQueryChange("");
    await tick();
    searchInput?.focus();
  }

  async function clearScope(): Promise<void> {
    activeScopeId = "";
    await tick();
    searchInput?.focus();
  }

  function scopeDescription(searchScope: CommunitySearchScope): string {
    if (searchScope.kind === "conversation")
      return "Search messages in this conversation";
    if (searchScope.kind === "projects") return "Search messages in projects";
    if (searchScope.kind === "project") return "Search messages in project";
    if (searchScope.kind === "repository")
      return "Search messages in repository";
    if (searchScope.kind === "registry") return "Search messages in registry";
    return `Search messages in this ${searchScope.kind}`;
  }

  function roomDescription(room: CommunityRoomModel): string {
    if (room.description) return room.description;
    if (room.kind === "direct") return "Direct message";
    return `${room.memberCount ?? 0} ${room.memberCount === 1 ? "member" : "members"}`;
  }

  function roomActivityLabel(room: CommunityRoomModel): string | undefined {
    if (!room.lastActivityAt) return undefined;
    const timestamp = Date.parse(room.lastActivityAt);
    if (!Number.isFinite(timestamp)) return undefined;
    return formatCommunityRelativeTime(Math.floor(timestamp / 1_000));
  }

  function messageDescription(message: CommunitySearchMessageModel): string {
    const room = rooms.find(
      (candidate) =>
        candidate.id === message.roomId || candidate.groupId === message.roomId,
    );
    if (room === undefined) return "Message";
    return room.kind === "direct"
      ? `Message in ${room.name}`
      : `Message in #${room.name}`;
  }

  function messageAuthor(
    message: CommunitySearchMessageModel,
  ): CommunityMemberModel {
    const known = [...authors, ...members].find(
      (member) => member.id === message.authorId,
    );
    if (known !== undefined) return known;
    const shortId =
      message.authorId.length > 12
        ? `${message.authorId.slice(0, 7)}…${message.authorId.slice(-5)}`
        : message.authorId;
    return {
      id: message.authorId,
      name: shortId,
      handle: shortId,
      initials: message.authorId.slice(0, 2).toUpperCase(),
    };
  }

  function messageActivityLabel(message: CommunitySearchMessageModel): string {
    if (message.createdAt) {
      const timestamp = Date.parse(message.createdAt);
      if (Number.isFinite(timestamp))
        return formatCommunityRelativeTime(Math.floor(timestamp / 1_000));
    }
    return message.timestamp;
  }

  function highlightedMessageSegments(
    content: string,
  ): readonly { text: string; highlighted: boolean }[] {
    const term = query.trim();
    if (term === "") return [{ text: content, highlighted: false }];

    const normalizedContent = content.toLocaleLowerCase();
    const normalizedTerm = term.toLocaleLowerCase();
    const segments: { text: string; highlighted: boolean }[] = [];
    let cursor = 0;
    let match = normalizedContent.indexOf(normalizedTerm);
    while (match !== -1) {
      if (match > cursor) {
        segments.push({
          text: content.slice(cursor, match),
          highlighted: false,
        });
      }
      const end = match + term.length;
      segments.push({ text: content.slice(match, end), highlighted: true });
      cursor = end;
      match = normalizedContent.indexOf(normalizedTerm, cursor);
    }
    if (cursor < content.length) {
      segments.push({ text: content.slice(cursor), highlighted: false });
    }
    return segments.length ? segments : [{ text: content, highlighted: false }];
  }
</script>

{#snippet messageResult(message: CommunitySearchMessageModel)}
  {@const author = messageAuthor(message)}
  <CommandView.Item
    class="community-search-command__message-result"
    value={`${author.name} ${message.content}`}
    onSelect={() => onSelectMessage(message)}
  >
    <CommandView.ItemIcon>
      <CommunityMemberAvatar member={author} size="small" decorative />
    </CommandView.ItemIcon>
    <CommandView.ItemLabel>{author.name}</CommandView.ItemLabel>
    <CommandView.ItemDescription
      >{messageDescription(message)}</CommandView.ItemDescription
    >
    <span
      class="community-search-command__message-time"
      data-ui-component="command-view"
      data-ui-part="trailing"
      title={message.createdAt ?? message.timestamp}
      >{messageActivityLabel(message)}</span
    >
    <span class="community-search-command__message-excerpt">
      {#each highlightedMessageSegments(message.content) as segment}
        {#if segment.highlighted}<mark>{segment.text}</mark
          >{:else}{segment.text}{/if}
      {/each}
    </span>
  </CommandView.Item>
{/snippet}

<Dialog.Root bind:open>
  <Dialog.Content
    class="community-search-dialog"
    showCloseButton={false}
    aria-describedby={undefined}
  >
    <Dialog.Title class="sr-only">{searchTitle}</Dialog.Title>
    <CommandView.Root
      class="community-search-command"
      label={searchTitle}
      bind:value={selectedCommandValue}
    >
      <CommandView.Input
        bind:ref={searchInput}
        class="community-search-command__input"
        value={query}
        placeholder={scoped
          ? "Search messages"
          : "Search for a channel, message, or person"}
        aria-label={searchTitle}
        aria-controls="community-search-command-results"
        oninput={(event) => onQueryChange(event.currentTarget.value)}
      >
        {#snippet start()}
          <SearchIcon aria-hidden="true" />
          {#if scoped && availableScope}
            <CommunityChip
              variant="muted"
              tone="accent"
              ariaLabel={`Remove ${availableScope.label} search scope`}
              onclick={clearScope}
            >
              {availableScope.label}
              <span aria-hidden="true">×</span>
            </CommunityChip>
          {/if}
        {/snippet}
      </CommandView.Input>
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
      <CommandView.List id="community-search-command-results">
        {#if !scoped && availableScope}
          <CommandView.Group>
            <CommandView.Item
              class="community-search-command__scope-action"
              value={`Search in ${availableScope.label}`}
              onSelect={selectScope}
            >
              <CommandView.ItemIcon>
                {#if availableScope.kind === "projects" || availableScope.kind === "project" || availableScope.kind === "repository"}
                  <FolderGit2Icon aria-hidden="true" />
                {:else}
                  <SearchIcon aria-hidden="true" />
                {/if}
              </CommandView.ItemIcon>
              <CommandView.ItemLabel
                >Search in {availableScope.label}</CommandView.ItemLabel
              >
              <CommandView.ItemDescription
                class="community-search-command__scope-description"
                >{scopeDescription(availableScope)}</CommandView.ItemDescription
              >
            </CommandView.Item>
          </CommandView.Group>
        {/if}
        {#if scoped}
          {#if query.trim()}
            <CommandView.Empty
              >No matching messages in {availableScope?.label}</CommandView.Empty
            >
            {#if scopedMessages.length}
              <CommandView.Group heading="Most relevant">
                {#each scopedMessages as message (message.id)}
                  {@render messageResult(message)}
                {/each}
              </CommandView.Group>
            {/if}
          {/if}
        {:else}
          <CommandView.Empty
            >No matching channels, messages, or people</CommandView.Empty
          >
          {#if visibleRooms.length || visibleMessages.length || visibleMembers.length}
            <CommandView.Group
              heading={query.trim() ? "Most relevant" : "Recent activity"}
            >
              {#each visibleRooms as room (room.id)}
                <CommandView.Item
                  value={`${room.name} ${room.description ?? ""}`}
                  onSelect={() => onSelectRoom(room)}
                >
                  <CommandView.ItemIcon>
                    {#if room.kind === "forum"}
                      <MessagesSquareIcon aria-hidden="true" />
                    {:else if room.kind === "direct"}
                      <CircleUserRoundIcon aria-hidden="true" />
                    {:else if room.isProjectChannel}
                      <CommunityProjectChannelIcon />
                    {:else}
                      <HashIcon aria-hidden="true" />
                    {/if}
                  </CommandView.ItemIcon>
                  <CommandView.ItemLabel>{room.name}</CommandView.ItemLabel>
                  <CommandView.ItemDescription
                    >{roomDescription(room)}</CommandView.ItemDescription
                  >
                  {#if roomActivityLabel(room) !== undefined}
                    <span
                      data-ui-component="command-view"
                      data-ui-part="trailing"
                      title={room.lastActivityAt}
                      >{roomActivityLabel(room)}</span
                    >
                  {/if}
                </CommandView.Item>
              {/each}
              {#each visibleMessages as message (message.id)}
                {@render messageResult(message)}
              {/each}
              {#each visibleMembers as member (member.id)}
                <CommandView.Item
                  value={`${member.name} ${member.handle}`}
                  onSelect={() => onSelectMember(member)}
                >
                  <CommandView.ItemIcon
                    ><UserIcon aria-hidden="true" /></CommandView.ItemIcon
                  >
                  <CommandView.ItemLabel>{member.name}</CommandView.ItemLabel>
                  <CommandView.ItemDescription
                    >{communityMemberHandleLabel(
                      member.handle,
                    )}</CommandView.ItemDescription
                  >
                </CommandView.Item>
              {/each}
            </CommandView.Group>
          {/if}
          <CommandView.Group heading="Actions">
            <CommandView.Item
              value="Browse channels"
              onSelect={onBrowseChannels}
            >
              <CommandView.ItemIcon>
                <span
                  class="community-search-command__browse-icon"
                  aria-hidden="true"
                >
                  <HashIcon />
                  <SearchIcon />
                </span>
              </CommandView.ItemIcon>
              <CommandView.ItemLabel>Browse channels</CommandView.ItemLabel>
            </CommandView.Item>
            {#if canCreateChannel}
              <CommandView.Item
                value="Create a new channel"
                onSelect={onCreateChannel}
              >
                <CommandView.ItemIcon
                  ><PlusIcon aria-hidden="true" /></CommandView.ItemIcon
                >
                <CommandView.ItemLabel
                  >Create a new channel</CommandView.ItemLabel
                >
              </CommandView.Item>
            {/if}
            {#if onCreateAgent}
              <CommandView.Item
                value="Create a new agent"
                onSelect={onCreateAgent}
              >
                <CommandView.ItemIcon
                  ><BotIcon aria-hidden="true" /></CommandView.ItemIcon
                >
                <CommandView.ItemLabel>Create a new agent</CommandView.ItemLabel
                >
              </CommandView.Item>
            {/if}
          </CommandView.Group>
        {/if}
      </CommandView.List>
    </CommandView.Root>
  </Dialog.Content>
</Dialog.Root>

<style>
  :global(.community-search-dialog[data-ui-part="dialog-content"]) {
    top: clamp(2rem, 10vh, 8rem);
    width: min(calc(100vw - 2rem), 42rem);
    max-width: min(calc(100vw - 2rem), 42rem);
    max-height: min(48rem, calc(100dvh - 4rem));
    translate: -50% 0;
    gap: 0;
    overflow: hidden;
    border-radius: 1.25rem;
    padding: 0;
    box-shadow:
      0 2rem 5rem -1.25rem rgb(0 0 0 / 32%),
      0 0.75rem 2rem -1rem rgb(0 0 0 / 24%);
  }

  :global(.community-search-command[data-ui-part="root"]) {
    --ui-command-view-radius: 1.25rem;
    --ui-command-view-list-max-height: min(39rem, calc(100dvh - 9.5rem));
    --ui-command-view-list-padding: 0.75rem;
    --ui-command-view-gap: 1rem;
    --ui-command-view-icon-size: 1.4rem;

    position: relative;
  }

  :global(.community-search-command__escape[data-ui-component="button"]) {
    position: absolute;
    z-index: 1;
    top: 0.5rem;
    right: 0.5rem;
    height: 1.5rem;
    min-height: 1.5rem;
    border-radius: 0.35rem;
    padding-inline: 0.4rem;
    color: var(--muted-foreground);
    font-size: var(--community-text-avatar-initials);
    font-weight: 500;
    text-transform: uppercase;
  }

  .community-search-command__browse-icon {
    position: relative;
    display: inline-grid;
    width: 1.25rem;
    height: 1.25rem;
    place-items: center;
  }

  .community-search-command__browse-icon :global(svg:first-child) {
    width: 1.1rem;
    height: 1.1rem;
  }

  .community-search-command__browse-icon :global(svg:last-child) {
    position: absolute;
    right: -0.2rem;
    bottom: -0.2rem;
    width: 0.65rem;
    height: 0.65rem;
    padding: 0.05rem;
    border-radius: 999px;
    background: var(--background);
    stroke-width: 2.5;
  }

  :global(.community-search-command__scope-action[data-ui-part="item"]) {
    margin: 0.35rem 0.25rem 0.5rem;
    min-height: 3.25rem;
    border: 1px solid color-mix(in srgb, var(--border) 75%, transparent);
    border-radius: 0.65rem;
    background: color-mix(in srgb, var(--muted) 30%, transparent);
    padding-inline: 0.75rem;
  }

  :global(
      .community-search-command__scope-action[data-ui-part="item"]:is(
          :hover,
          [data-selected="true"]
        )
    ) {
    background: color-mix(in srgb, var(--muted) 55%, transparent);
  }

  :global(
      .community-search-command__scope-description[data-ui-part="item-description"]
    ) {
    grid-area: shortcut;
    margin-inline-start: auto;
    padding-inline-start: 1rem;
  }

  :global(.community-search-command__message-result[data-ui-part="item"]) {
    grid-template-areas:
      "icon label shortcut"
      "icon description shortcut"
      ". excerpt excerpt";
    align-items: start;
    row-gap: 0.1rem;
    padding-block: 0.65rem;
  }

  :global(
      .community-search-command__message-result[data-ui-part="item"]
        [data-ui-part="item-icon"]
    ) {
    width: 2rem;
    height: 2rem;
    align-self: start;
  }

  .community-search-command__message-time {
    align-self: start;
  }

  .community-search-command__message-excerpt {
    display: -webkit-box;
    grid-area: excerpt;
    overflow: hidden;
    margin-block-start: 0.25rem;
    font-size: var(--community-text-body);
    line-height: 1.35;
    text-overflow: ellipsis;
    overflow-wrap: anywhere;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .community-search-command__message-excerpt mark {
    border-radius: 0.15rem;
    color: inherit;
  }

  @media (max-width: 40rem) {
    :global(.community-search-dialog[data-ui-part="dialog-content"]) {
      top: 0.5rem;
      width: calc(100vw - 1rem);
      max-width: calc(100vw - 1rem);
      max-height: calc(100dvh - 1rem);
    }

    :global(.community-search-command[data-ui-part="root"]) {
      --ui-command-view-list-max-height: calc(100dvh - 6rem);
    }
  }
</style>
