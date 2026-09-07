<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Command from "@lapismd/design-core/shadcn/command";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as DropdownMenu from "@lapismd/design-core/shadcn/dropdown-menu";
  import EllipsisIcon from "@lucide/svelte/icons/ellipsis";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import UserMinusIcon from "@lucide/svelte/icons/user-minus";
  import XIcon from "@lucide/svelte/icons/x";

  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import type { CommunityMemberModel } from "../community-workspace/model.js";

  let {
    open = $bindable(false),
    title = "Members",
    members,
    results = [],
    groupMemberIds,
    currentMemberId,
    roomKind = "channel",
    selectedIds = [],
    mode = "view",
    completeness = "complete",
    maxSelected = 8,
    onSearch,
    onSelect,
    onRemove,
    onConfirm,
  }: {
    open?: boolean;
    title?: string;
    members: readonly CommunityMemberModel[];
    results?: readonly CommunityMemberModel[];
    groupMemberIds?: readonly string[];
    currentMemberId?: string;
    roomKind?: "channel" | "forum" | "conversation";
    selectedIds?: readonly string[];
    mode?: "view" | "manage" | "select";
    completeness?: "complete" | "partial" | "unavailable";
    maxSelected?: number;
    onSearch: (query: string) => void;
    onSelect: (member: CommunityMemberModel) => void;
    onRemove: (member: CommunityMemberModel) => void;
    onConfirm?: () => void;
  } = $props();

  let query = $state("");
  let wasOpen = false;

  const normalizedQuery = $derived(query.trim().toLocaleLowerCase());
  const isSearching = $derived(normalizedQuery !== "");
  const membershipIds = $derived(
    new Set(groupMemberIds ?? members.map((member) => member.id)),
  );
  const directory = $derived(distinctMembers([...members, ...results]));
  const matchingMembers = $derived(
    directory.filter((member) => memberMatches(member, normalizedQuery)),
  );
  const currentMembers = $derived(
    mode === "select"
      ? matchingMembers
      : matchingMembers.filter((member) => membershipIds.has(member.id)),
  );
  const otherMembers = $derived(
    mode === "select" || !isSearching
      ? []
      : matchingMembers.filter((member) => !membershipIds.has(member.id)),
  );
  const roomNoun = $derived(
    roomKind === "forum"
      ? "forum"
      : roomKind === "conversation"
        ? "conversation"
        : "channel",
  );
  const description = $derived(
    completeness === "complete"
      ? "Search the current member directory."
      : completeness === "partial"
        ? "This relay returned a partial member list. Search may find additional profiles."
        : "The relay does not expose a complete member list. Enter an npub or hex public key to continue.",
  );

  $effect(() => {
    if (open && !wasOpen) {
      query = "";
      onSearch("");
    }
    wasOpen = open;
  });

  function distinctMembers(
    candidates: readonly CommunityMemberModel[],
  ): CommunityMemberModel[] {
    return candidates.filter(
      (member, index) =>
        candidates.findIndex((candidate) => candidate.id === member.id) ===
        index,
    );
  }

  function memberMatches(
    member: CommunityMemberModel,
    normalized: string,
  ): boolean {
    return (
      normalized === "" ||
      `${member.name} ${member.handle} ${member.id}`
        .toLocaleLowerCase()
        .includes(normalized)
    );
  }

  function memberName(member: CommunityMemberModel): string {
    return member.id === currentMemberId ? "You" : member.name;
  }
</script>

{#snippet memberIdentity(member: CommunityMemberModel)}
  <CommunityMemberAvatar {member} showPresence decorative />
  <span class="community-member-command__member-copy">
    <span class="community-member-command__member-heading">
      <strong>{memberName(member)}</strong>
      {#if member.role}
        <small class="community-member-command__member-role"
          >{member.role}</small
        >
      {/if}
    </span>
    <small>{member.handle}</small>
  </span>
{/snippet}

<Command.Dialog
  bind:open
  class="community-member-command"
  {title}
  {description}
  label="Search members"
  shouldFilter={false}
>
  <div class="community-member-command__header">
    <h2>{title}</h2>
    <Dialog.Close>
      {#snippet child({ props })}
        <Button
          {...props}
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Close members"
          title="Close members"
        >
          <XIcon aria-hidden="true" />
        </Button>
      {/snippet}
    </Dialog.Close>
  </div>
  <div class="community-member-command__input-row">
    <Command.Input
      class="community-member-command__input"
      placeholder="Search members or paste an npub"
      aria-label="Search members"
      aria-controls="community-member-command-results"
      bind:value={query}
      oninput={(event) => onSearch(event.currentTarget.value)}
    />
  </div>

  {#if mode === "select" && selectedIds.length}
    <div
      class="community-member-command__chips"
      aria-label="Selected recipients"
    >
      {#each selectedIds as id (id)}
        {@const member = members.find((candidate) => candidate.id === id)}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onclick={() => member && onRemove(member)}
        >
          {member?.name ?? id.slice(0, 12)}
          <XIcon data-icon="inline-end" aria-hidden="true" />
        </Button>
      {/each}
    </div>
  {/if}

  <Command.List id="community-member-command-results">
    <Command.Empty>
      {isSearching
        ? "No members found"
        : `No members are available for this ${roomNoun}`}
    </Command.Empty>
    <Command.Group
      heading={mode === "select"
        ? "People"
        : isSearching
          ? `In this ${roomNoun}`
          : "Members"}
    >
      {#each currentMembers as member (member.id)}
        {#if mode === "manage"}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              {#snippet child({ props })}
                <Command.Item
                  {...props}
                  class="community-member-command__member-menu-trigger"
                  value={`${member.name} ${member.handle} ${member.id}`}
                  aria-label={`Manage ${memberName(member)}`}
                  aria-expanded={undefined}
                >
                  {@render memberIdentity(member)}
                  <span
                    class="community-member-command__member-menu-icon"
                    aria-hidden="true"
                  >
                    <EllipsisIcon />
                  </span>
                </Command.Item>
              {/snippet}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content
              class="community-member-command__member-menu"
              align="end"
              sideOffset={4}
            >
              <DropdownMenu.Group>
                <DropdownMenu.Item
                  variant="destructive"
                  onSelect={() => onRemove(member)}
                >
                  <Trash2Icon data-icon="inline-start" aria-hidden="true" />
                  Remove from {roomNoun}
                </DropdownMenu.Item>
              </DropdownMenu.Group>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        {:else}
          <Command.Item
            value={`${member.name} ${member.handle} ${member.id}`}
            data-selected-recipient={selectedIds.includes(member.id)
              ? ""
              : undefined}
            onSelect={() => onSelect(member)}
            disabled={mode === "select" &&
              selectedIds.length >= maxSelected &&
              !selectedIds.includes(member.id)}
          >
            {@render memberIdentity(member)}
            {#if mode === "select" && selectedIds.includes(member.id)}
              <UserMinusIcon data-icon="inline-end" aria-hidden="true" />
            {/if}
          </Command.Item>
        {/if}
      {/each}
    </Command.Group>
    {#if mode !== "select" && isSearching}
      <Command.Group heading={`Not in this ${roomNoun}`}>
        {#each otherMembers as member (member.id)}
          <Command.Item
            value={`${member.name} ${member.handle} ${member.id}`}
            aria-label={mode === "manage"
              ? `Add ${member.name} to ${roomNoun}`
              : undefined}
            onSelect={() => onSelect(member)}
          >
            {@render memberIdentity(member)}
            {#if mode === "manage"}
              <span class="community-member-command__add" aria-hidden="true"
                >Add</span
              >
            {/if}
          </Command.Item>
        {/each}
      </Command.Group>
    {/if}
  </Command.List>

  {#if mode === "select" && onConfirm}
    <div class="community-member-command__footer">
      <Dialog.Close>
        {#snippet child({ props })}
          <Button {...props} type="button" variant="ghost">Cancel</Button>
        {/snippet}
      </Dialog.Close>
      <Button
        type="button"
        disabled={selectedIds.length === 0}
        onclick={onConfirm}>Start message</Button
      >
    </div>
  {/if}
</Command.Dialog>

<style>
  :global(.community-member-command) {
    top: clamp(2rem, 10vh, 8rem);
    width: min(calc(100vw - 2rem), 52rem);
    max-width: min(calc(100vw - 2rem), 52rem) !important;
    max-height: min(44rem, calc(100vh - 4rem));
    translate: -50% 0;
    border-radius: 1.25rem !important;
    box-shadow:
      0 2rem 5rem -1.25rem rgb(0 0 0 / 34%),
      0 0.75rem 2rem -1rem rgb(0 0 0 / 26%) !important;
    font-size: 1rem;
  }

  :global([data-ui-part="dialog-overlay"]:has(+ .community-member-command)) {
    background: color-mix(in srgb, var(--background) 48%, transparent);
    -webkit-backdrop-filter: blur(1.1rem) saturate(0.8);
    backdrop-filter: blur(1.1rem) saturate(0.8);
  }

  :global(.community-member-command [data-ui-part="command"]) {
    padding: 0;
  }

  .community-member-command__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.35rem 1.5rem 1rem;
  }

  .community-member-command__header h2 {
    margin: 0;
    font-size: 1.45rem;
    font-weight: 650;
    letter-spacing: -0.02em;
  }

  .community-member-command__input-row {
    --ui-input-group-focus-ring-color: transparent;

    display: flex;
    align-items: center;
    gap: 1rem;
    margin: 0 1.5rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 0.95rem;
    padding: 0.45rem 0.75rem;
  }

  :global(
      .community-member-command__input-row
        [data-ui-part="command-input-wrapper"]
    ) {
    min-width: 0;
    flex: 1;
    padding: 0;
    outline: 0 !important;
    box-shadow: none !important;
  }

  :global(
      .community-member-command__input-row
        [data-ui-component="input-group"][data-ui-part="input-group"]
    ),
  :global(
      .community-member-command__input-row
        [data-ui-component="input-group"][data-ui-part="input-group"]:focus-within
    ),
  :global(.community-member-command__input[data-slot="input-group-control"]) {
    height: 2.75rem !important;
    border: 0 !important;
    border-color: transparent !important;
    outline: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    --tw-ring-color: transparent !important;
    --tw-ring-shadow: 0 0 #0000 !important;
  }

  :global(
      .community-member-command__input-row [data-slot="input-group-control"]
    ) {
    font-size: 1.15rem;
  }

  :global(
      .community-member-command__input-row [data-ui-part="command-search-icon"]
    ) {
    width: 1.35rem;
    height: 1.35rem;
    opacity: 1;
  }

  .community-member-command__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    border-block-end: 1px solid var(--border);
    padding: 0.75rem 1.5rem;
  }

  :global(.community-member-command [data-ui-part="command-list"]) {
    max-height: min(33rem, calc(100vh - 12rem));
    margin: 0 1.5rem 1.5rem;
    border: 1px solid var(--border);
    border-radius: 1rem;
    padding: 0.75rem;
  }

  :global(.community-member-command [data-ui-part="command-group-heading"]) {
    padding: 0.75rem 0.5rem 0.5rem;
    font-size: 0.95rem;
    font-weight: 500;
  }

  :global(.community-member-command [data-ui-part="command-item"]) {
    min-height: 3.75rem;
    gap: 1rem;
    border-radius: 0.8rem !important;
    padding: 0.65rem 0.75rem;
    font-size: 1rem;
  }

  :global(
      .community-member-command
        [data-ui-part="command-item"][data-selected-recipient]
    ) {
    background: var(--accent);
  }

  .community-member-command__member-copy {
    display: grid;
    min-width: 0;
    flex: 1;
    gap: 0.15rem;
  }

  .community-member-command__member-heading {
    display: flex;
    min-width: 0;
    align-items: baseline;
    gap: 0.45rem;
  }

  .community-member-command__member-copy strong,
  .community-member-command__member-copy small {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .community-member-command__member-copy small {
    color: var(--muted-foreground);
    font-size: 0.9rem;
    font-weight: 400;
  }

  .community-member-command__member-role {
    flex: none;
  }

  :global(
      .community-member-command__member-menu-trigger[data-ui-component="command"]
    ) {
    border-radius: 0.7rem;
  }

  .community-member-command__member-menu-icon {
    display: grid;
    width: 2rem;
    height: 2rem;
    margin-inline-start: auto;
    place-items: center;
    border-radius: 0.7rem;
    background: var(--muted);
  }

  :global(.community-member-command__member-menu) {
    width: min(24rem, calc(100vw - 2rem)) !important;
    min-width: 15rem;
  }

  .community-member-command__add {
    margin-inline-start: auto;
    border-radius: 0.7rem;
    background: var(--primary);
    color: var(--primary-foreground);
    padding: 0.45rem 0.85rem;
    font-weight: 500;
  }

  .community-member-command__footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    border-block-start: 1px solid var(--border);
    padding: 0.85rem 1.5rem 1rem;
  }

  @media (max-width: 40rem) {
    :global(.community-member-command) {
      top: 0.5rem;
      width: calc(100vw - 1rem);
      max-width: calc(100vw - 1rem) !important;
      max-height: calc(100vh - 1rem);
    }

    .community-member-command__input-row,
    .community-member-command__chips,
    .community-member-command__footer {
      padding-inline: 1rem;
    }

    .community-member-command__header {
      padding-inline: 1rem;
    }

    .community-member-command__input-row,
    :global(.community-member-command [data-ui-part="command-list"]) {
      margin-inline: 1rem;
    }
  }
</style>
