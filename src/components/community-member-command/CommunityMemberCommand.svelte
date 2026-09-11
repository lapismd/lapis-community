<script lang="ts">
  import { tick } from "svelte";
  import { DialogFrame } from "@lapismd/design-core/forms/dialog";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { Checkbox } from "@lapismd/design-core/shadcn/checkbox";
  import * as Command from "@lapismd/design-core/shadcn/command";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as DropdownMenu from "@lapismd/design-core/shadcn/dropdown-menu";
  import EllipsisIcon from "@lucide/svelte/icons/ellipsis";
  import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import UserMinusIcon from "@lucide/svelte/icons/user-minus";
  import XIcon from "@lucide/svelte/icons/x";

  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import type {
    CommunityMemberModel,
    CommunityRoleDefinition,
  } from "../community-workspace/model.js";

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
    selectionLabel = "Selected recipients",
    confirmLabel = "Start message",
    allowEmptySelection = false,
    completeness = "complete",
    maxSelected = 8,
    onSearch,
    onSelect,
    onRemove,
    roleDefinitions = [],
    onSetRoles,
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
    selectionLabel?: string;
    confirmLabel?: string;
    allowEmptySelection?: boolean;
    completeness?: "complete" | "partial" | "unavailable";
    maxSelected?: number;
    onSearch: (query: string) => void;
    onSelect: (member: CommunityMemberModel) => void;
    onRemove: (member: CommunityMemberModel) => void;
    roleDefinitions?: readonly CommunityRoleDefinition[];
    onSetRoles?: (
      member: CommunityMemberModel,
      roles: readonly string[],
    ) => Promise<void>;
    onConfirm?: () => void;
  } = $props();

  let query = $state("");
  let wasOpen = open;
  let roleDialogOpen = $state(false);
  let roleMember = $state<CommunityMemberModel>();
  let selectedRoles = $state<string[]>([]);
  let rolePending = $state(false);
  let roleError = $state("");

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
  const availableRoleDefinitions = $derived(
    distinctRoleDefinitions(roleDefinitions, roleMember?.roles ?? []),
  );

  $effect(() => {
    const opening = open && !wasOpen;
    wasOpen = open;
    if (!opening) return;
    query = "";
    let cancelled = false;
    // Let the dialog mount before a synchronous source refresh updates its content.
    void tick().then(() => {
      if (!cancelled) onSearch("");
    });
    return () => {
      cancelled = true;
    };
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

  function openRoleDialog(member: CommunityMemberModel): void {
    roleMember = member;
    selectedRoles = (member.roles ?? []).filter(isAssignableRole);
    roleError = "";
    roleDialogOpen = true;
  }

  function toggleRole(roleId: string, checked: boolean): void {
    selectedRoles = checked
      ? [...new Set([...selectedRoles, roleId])].toSorted()
      : selectedRoles.filter((candidate) => candidate !== roleId);
  }

  async function saveRoles(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (roleMember === undefined || onSetRoles === undefined) return;
    rolePending = true;
    roleError = "";
    try {
      await onSetRoles(roleMember, selectedRoles);
      roleDialogOpen = false;
    } catch (cause) {
      roleError =
        cause instanceof Error
          ? cause.message
          : `Could not update ${memberName(roleMember)}`;
    } finally {
      rolePending = false;
    }
  }

  function distinctRoleDefinitions(
    definitions: readonly CommunityRoleDefinition[],
    assignedRoles: readonly string[],
  ): CommunityRoleDefinition[] {
    const byId = new Map(
      definitions
        .filter((definition) => isAssignableRole(definition.id))
        .map((definition) => [definition.id, definition]),
    );
    for (const role of assignedRoles) {
      if (isAssignableRole(role) && !byId.has(role)) {
        byId.set(role, {
          id: role,
          label: role
            .split(/[-_\s]+/u)
            .filter(Boolean)
            .map((part) => part[0]!.toLocaleUpperCase() + part.slice(1))
            .join(" "),
          description: "This role is currently assigned by the relay.",
        });
      }
    }
    return [...byId.values()].toSorted((left, right) =>
      left.label.localeCompare(right.label),
    );
  }

  function isAssignableRole(role: string): boolean {
    return !["member", "admin", "administrator"].includes(
      role.trim().toLocaleLowerCase(),
    );
  }
</script>

{#snippet selectionFooter()}
  {#if mode === "select" && onConfirm}
    <div class="community-member-command__footer">
      <Button type="button" variant="outline" onclick={() => (open = false)}
        >Cancel</Button
      >
      <Button
        type="button"
        disabled={!allowEmptySelection && selectedIds.length === 0}
        onclick={onConfirm}>{confirmLabel}</Button
      >
    </div>
  {/if}
{/snippet}

{#snippet memberIdentity(member: CommunityMemberModel)}
  <CommunityMemberAvatar {member} showPresence decorative />
  <span class="community-member-command__member-copy">
    <span class="community-member-command__member-heading">
      <strong>{memberName(member)}</strong>
      {#if member.administrator}
        <CommunityChip variant="muted">Administrator</CommunityChip>
      {:else if member.role && member.role !== "member"}
        <CommunityChip>{member.role}</CommunityChip>
      {/if}
    </span>
    <small>
      {member.handle}{member.administrator ? " · Relay-managed access" : ""}
    </small>
  </span>
{/snippet}

<Dialog.Root bind:open
  ><DialogFrame
    {title}
    {description}
    size="form"
    bodyPadding="none"
    closeLabel="Close members"
    {...mode === "select" && onConfirm ? { footer: selectionFooter } : {}}
    ><Command.Root
      class="community-member-command"
      label="Search members"
      shouldFilter={false}
    >
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
          aria-label={selectionLabel}
        >
          {#each selectedIds as id (id)}
            {@const member = members.find((candidate) => candidate.id === id)}
            <CommunityChip
              variant="muted"
              onclick={() => member && onRemove(member)}
            >
              {member?.name ?? id.slice(0, 12)}
              <XIcon data-icon="inline-end" aria-hidden="true" />
            </CommunityChip>
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
            {#if mode === "manage" && !member.administrator}
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
                    {#if onSetRoles}
                      <DropdownMenu.Item
                        onSelect={() => openRoleDialog(member)}
                      >
                        <ShieldCheckIcon
                          data-icon="inline-start"
                          aria-hidden="true"
                        />
                        Manage roles
                      </DropdownMenu.Item>
                    {/if}
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
            {:else if mode === "manage" && member.administrator}
              <Command.Item
                value={`${member.name} ${member.handle} ${member.id}`}
                aria-label={`${memberName(member)}, administrator`}
                onSelect={() => {}}
              >
                {@render memberIdentity(member)}
              </Command.Item>
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
    </Command.Root></DialogFrame
  ></Dialog.Root
>

<Dialog.Root bind:open={roleDialogOpen}>
  <DialogFrame size="form">
    {#snippet title()}Manage roles{/snippet}
    {#snippet description()}
      Choose the relay-defined roles for {roleMember
        ? memberName(roleMember)
        : "this member"}. Member access is always retained.
    {/snippet}

    <form
      id="communitymembercommand-form-0"
      class="community-member-role-dialog__form"
      onsubmit={saveRoles}
    >
      <div class="community-member-role-dialog__roles">
        <div class="community-member-role-dialog__baseline">
          <span>
            <strong>Member</strong>
            <small>Can access this {roomNoun} under the relay's policy.</small>
          </span>
          <CommunityChip variant="muted">Always on</CommunityChip>
        </div>
        {#each availableRoleDefinitions as definition (definition.id)}
          <label class="community-member-role-dialog__role">
            <Checkbox
              checked={selectedRoles.includes(definition.id)}
              onCheckedChange={(checked) =>
                toggleRole(definition.id, checked === true)}
              aria-label={definition.label}
            />
            <span>
              <strong>{definition.label}</strong>
              {#if definition.description}
                <small>{definition.description}</small>
              {/if}
            </span>
          </label>
        {/each}
      </div>

      {#if roleError}
        <p class="community-member-role-dialog__error" role="alert">
          {roleError}
        </p>
      {/if}
    </form>

    {#snippet footer()}
      <Button
        form="communitymembercommand-form-0"
        type="button"
        variant="outline"
        disabled={rolePending}
        onclick={() => (roleDialogOpen = false)}>Cancel</Button
      >
      <Button
        form="communitymembercommand-form-0"
        type="submit"
        disabled={rolePending}
      >
        {rolePending ? "Saving…" : "Save roles"}
      </Button>
    {/snippet}
  </DialogFrame>
</Dialog.Root>

<style>
  :global(.community-member-command [data-ui-part="command"]) {
    padding: 0;
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
    font-size: var(--community-text-body);
  }

  :global(
      .community-member-command__input-row [data-ui-part="command-search-icon"]
    ) {
    width: 1.1rem;
    height: 1.1rem;
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
    font-size: var(--community-text-secondary);
    font-weight: 500;
  }

  :global(.community-member-command [data-ui-part="command-item"]) {
    min-height: 3.75rem;
    gap: 1rem;
    border-radius: 0.8rem !important;
    padding: 0.65rem 0.75rem;
    font-size: var(--community-text-body);
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
    font-size: var(--community-text-secondary);
    font-weight: 400;
  }

  .community-member-role-dialog__form,
  .community-member-role-dialog__roles {
    display: grid;
    gap: 1rem;
  }

  .community-member-role-dialog__baseline,
  .community-member-role-dialog__role {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.85rem;
  }

  .community-member-role-dialog__baseline {
    align-items: center;
    justify-content: space-between;
    background: var(--muted);
  }

  .community-member-role-dialog__baseline > span,
  .community-member-role-dialog__role > span {
    display: grid;
    flex: 1;
    gap: 0.2rem;
  }

  .community-member-role-dialog__error {
    margin: 0;
    color: var(--destructive);
    font-size: var(--community-text-body);
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
    .community-member-command__input-row,
    .community-member-command__chips,
    .community-member-command__footer {
      padding-inline: 1rem;
    }

    .community-member-command__input-row,
    :global(.community-member-command [data-ui-part="command-list"]) {
      margin-inline: 1rem;
    }
  }
</style>
