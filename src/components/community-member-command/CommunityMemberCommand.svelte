<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Command from "@lapismd/design-core/shadcn/command";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import UserMinusIcon from "@lucide/svelte/icons/user-minus";
  import UserPlusIcon from "@lucide/svelte/icons/user-plus";
  import XIcon from "@lucide/svelte/icons/x";

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
    onSearch = () => {},
    onSelect = () => {},
    onRemove = () => {},
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
    onSearch?: (query: string) => void;
    onSelect?: (member: CommunityMemberModel) => void;
    onRemove?: (member: CommunityMemberModel) => void;
    onConfirm?: () => void;
  } = $props();

  const visible = $derived(results.length ? results : members);
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="community-member-command">
    <Dialog.Header>
      <Dialog.Title>{title}</Dialog.Title>
      <Dialog.Description>
        {#if completeness === "complete"}Search the current member directory.{:else if completeness === "partial"}This
          relay returned a partial member list. Search may find additional
          profiles.{:else}The relay does not expose a complete member list.
          Enter an npub or hex public key to continue.{/if}
      </Dialog.Description>
    </Dialog.Header>
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
    <Command.Root>
      <Command.Input
        placeholder="Search members or paste an npub"
        aria-controls="community-member-command-results"
        oninput={(event) => onSearch(event.currentTarget.value)}
      />
      <Command.List id="community-member-command-results">
        <Command.Empty>No members found</Command.Empty>
        <Command.Group heading="People">
          {#each visible as member (member.id)}
            {@const isCurrentMember = members.some(
              (candidate) => candidate.id === member.id,
            )}
            <Command.Item
              value={`${member.name} ${member.handle} ${member.id}`}
              onSelect={() =>
                mode === "manage" && isCurrentMember
                  ? onRemove(member)
                  : onSelect(member)}
              disabled={mode === "select" &&
                selectedIds.length >= maxSelected &&
                !selectedIds.includes(member.id)}
            >
              <span class="community-member-command__avatar" aria-hidden="true"
                >{member.initials}</span
              >
              <span
                ><strong>{member.name}</strong><small>{member.handle}</small
                ></span
              >
              {#if mode === "manage" && isCurrentMember}<UserMinusIcon
                  data-icon="inline-end"
                  aria-label="Remove member"
                />{:else if mode === "manage"}<UserPlusIcon
                  data-icon="inline-end"
                  aria-label="Add member"
                />{/if}
              {#if mode === "select" && selectedIds.includes(member.id)}<UserMinusIcon
                  data-icon="inline-end"
                  aria-hidden="true"
                />{/if}
            </Command.Item>
          {/each}
        </Command.Group>
      </Command.List>
    </Command.Root>
    {#if onConfirm}
      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => (open = false)}
          >Cancel</Button
        >
        <Button
          type="button"
          disabled={mode === "select" && selectedIds.length === 0}
          onclick={onConfirm}
          >{mode === "select" ? "Start message" : "Done"}</Button
        >
      </Dialog.Footer>
    {/if}
  </Dialog.Content>
</Dialog.Root>

<style>
  :global(.community-member-command) {
    width: min(calc(100vw - 2rem), 34rem);
  }
  .community-member-command__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .community-member-command__avatar {
    display: grid;
    width: 2rem;
    height: 2rem;
    place-items: center;
    border-radius: 50%;
    color: var(--primary-foreground);
    background: var(--primary);
    font-size: 0.65rem;
    font-weight: 700;
  }
  :global(
      .community-member-command [data-slot="command-item"] > span:nth-child(2)
    ) {
    display: grid;
    min-width: 0;
    flex: 1;
  }
  :global(.community-member-command small) {
    color: var(--muted-foreground);
  }
</style>
