<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Command from "@lapismd/design-core/shadcn/command";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import UserMinusIcon from "@lucide/svelte/icons/user-minus";
  import UserPlusIcon from "@lucide/svelte/icons/user-plus";
  import XIcon from "@lucide/svelte/icons/x";

  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import type { CommunityMemberModel } from "../community-workspace/model.js";

  let {
    open = $bindable(false),
    title = "Members",
    members,
    results = [],
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
    selectedIds?: readonly string[];
    mode?: "view" | "manage" | "select";
    completeness?: "complete" | "partial" | "unavailable";
    maxSelected?: number;
    onSearch: (query: string) => void;
    onSelect: (member: CommunityMemberModel) => void;
    onRemove: (member: CommunityMemberModel) => void;
    onConfirm?: () => void;
  } = $props();

  const visible = $derived(results.length ? results : members);
  const description = $derived(
    completeness === "complete"
      ? "Search the current member directory."
      : completeness === "partial"
        ? "This relay returned a partial member list. Search may find additional profiles."
        : "The relay does not expose a complete member list. Enter an npub or hex public key to continue.",
  );
</script>

<Command.Dialog
  bind:open
  class="community-member-command"
  {title}
  {description}
>
  <div class="community-member-command__input-row">
    <Command.Input
      class="community-member-command__input"
      placeholder="Search members or paste an npub"
      aria-label="Search members"
      aria-controls="community-member-command-results"
      oninput={(event) => onSearch(event.currentTarget.value)}
    />
    <Dialog.Close>
      {#snippet child({ props })}
        <Button
          {...props}
          variant="outline"
          size="sm"
          class="community-member-command__escape"
          aria-label="Close members"
          title="Close members">Esc</Button
        >
      {/snippet}
    </Dialog.Close>
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
    <Command.Empty>No members found</Command.Empty>
    <Command.Group heading="People">
      {#each visible as member (member.id)}
        {@const isCurrentMember = members.some(
          (candidate) => candidate.id === member.id,
        )}
        <Command.Item
          value={`${member.name} ${member.handle} ${member.id}`}
          data-selected-recipient={selectedIds.includes(member.id)
            ? ""
            : undefined}
          onSelect={() =>
            mode === "manage" && isCurrentMember
              ? onRemove(member)
              : onSelect(member)}
          disabled={mode === "select" &&
            selectedIds.length >= maxSelected &&
            !selectedIds.includes(member.id)}
        >
          <CommunityMemberAvatar {member} showPresence decorative />
          <span class="community-member-command__member-copy">
            <strong>{member.name}</strong>
            <small>{member.handle}</small>
          </span>
          {#if mode === "manage" && isCurrentMember}
            <UserMinusIcon data-icon="inline-end" aria-label="Remove member" />
          {:else if mode === "manage"}
            <UserPlusIcon data-icon="inline-end" aria-label="Add member" />
          {:else if mode === "select" && selectedIds.includes(member.id)}
            <UserMinusIcon data-icon="inline-end" aria-hidden="true" />
          {/if}
        </Command.Item>
      {/each}
    </Command.Group>
  </Command.List>

  {#if onConfirm}
    <div class="community-member-command__footer">
      <Dialog.Close>
        {#snippet child({ props })}
          <Button {...props} type="button" variant="ghost">Cancel</Button>
        {/snippet}
      </Dialog.Close>
      <Button
        type="button"
        disabled={mode === "select" && selectedIds.length === 0}
        onclick={onConfirm}
        >{mode === "select" ? "Start message" : "Done"}</Button
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

  .community-member-command__input-row {
    --ui-input-group-focus-ring-color: transparent;

    display: flex;
    align-items: center;
    gap: 1rem;
    border-block-end: 1px solid var(--border);
    padding: 1.15rem 1.5rem;
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

  :global(.community-member-command__escape[data-ui-component="button"]) {
    height: 2rem;
    border-radius: 0.45rem;
    padding-inline: 0.65rem;
    color: var(--muted-foreground);
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
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
  }
</style>
