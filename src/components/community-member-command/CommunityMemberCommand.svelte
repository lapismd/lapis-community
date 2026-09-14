<script lang="ts">
  import { tick } from "svelte";
  import { DialogFrame } from "@lapismd/design-core/forms/dialog";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { Checkbox } from "@lapismd/design-core/shadcn/checkbox";
  import * as CommandView from "@lapismd/design-core/shadcn/command-view";
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
    presentation = "dialog",
    searchLabel = "Search members",
    disabled = false,
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
    presentation?: "dialog" | "inline";
    searchLabel?: string;
    disabled?: boolean;
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

  const commandId = $props.id();
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
  const directoryNotice = $derived(
    completeness === "partial"
      ? "Some members may be missing. Search can find additional profiles."
      : completeness === "unavailable"
        ? "Enter an npub or hex public key to find someone."
        : undefined,
  );
  const availableRoleDefinitions = $derived(
    distinctRoleDefinitions(roleDefinitions, roleMember?.roles ?? []),
  );

  $effect(() => {
    const visible = presentation === "inline" || open;
    const opening = visible && !wasOpen;
    wasOpen = visible;
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
    const directory = new Map<string, CommunityMemberModel>();
    const unresolved = (member: CommunityMemberModel) =>
      member.name === member.id ||
      member.name === member.id.slice(0, 12) ||
      member.name === `${member.id.slice(0, 7)}…${member.id.slice(-5)}`;
    for (const member of candidates) {
      const existing = directory.get(member.id);
      if (!existing) directory.set(member.id, member);
      // A search can resolve a cached key, and a membership refresh can resolve
      // an earlier key search. Neither should replace a known name with a key.
      else if (unresolved(existing) && !unresolved(member))
        directory.set(member.id, {
          ...existing,
          name: member.name,
          handle: member.handle,
          initials: member.initials,
          ...(member.avatarUrl ? { avatarUrl: member.avatarUrl } : {}),
        });
    }
    return [...directory.values()];
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
  <CommandView.ItemIcon class="community-member-command__avatar">
    <CommunityMemberAvatar {member} showPresence decorative />
  </CommandView.ItemIcon>
  <CommandView.ItemLabel>
    <span class="community-member-command__member-heading">
      <strong>{memberName(member)}</strong>
      {#if member.administrator}
        <CommunityChip variant="muted">Administrator</CommunityChip>
      {:else if member.role && member.role !== "member"}
        <CommunityChip>{member.role}</CommunityChip>
      {/if}
    </span>
  </CommandView.ItemLabel>
  <CommandView.ItemDescription>
    {member.handle}{member.administrator ? " · Relay-managed access" : ""}
  </CommandView.ItemDescription>
{/snippet}

{#snippet memberCommand()}
  <CommandView.Root
    class={`community-member-command${presentation === "inline" ? " community-member-command--inline" : ""}`}
    data-presentation={presentation}
    label={searchLabel}
    shouldFilter={false}
  >
    <CommandView.Input
      class="community-member-command__input"
      placeholder="Search members or paste an npub"
      aria-label={searchLabel}
      id={`${commandId}-search`}
      {disabled}
      aria-controls={`${commandId}-results`}
      bind:value={query}
      oninput={(event) => onSearch(event.currentTarget.value)}
    />

    {#if directoryNotice}
      <p class="community-member-command__directory-notice" role="status">
        {directoryNotice}
      </p>
    {/if}

    {#if mode === "select" && selectedIds.length}
      <div class="community-member-command__chips" aria-label={selectionLabel}>
        {#each selectedIds as id (id)}
          {@const member = directory.find(
            (candidate) => candidate.id === id,
          ) ?? { id, name: id.slice(0, 12), handle: id, initials: "?" }}
          <CommunityChip
            variant="muted"
            {disabled}
            ariaLabel={`Remove ${member.name}`}
            onclick={() => onRemove(member)}
          >
            {member?.name ?? id.slice(0, 12)}
            <XIcon data-icon="inline-end" aria-hidden="true" />
          </CommunityChip>
        {/each}
      </div>
    {/if}

    <CommandView.List id={`${commandId}-results`}>
      <CommandView.Empty>
        {isSearching
          ? "No members found"
          : `No members are available for this ${roomNoun}`}
      </CommandView.Empty>
      <CommandView.Group
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
                  <CommandView.Item
                    {...props}
                    class="community-member-command__member-menu-trigger"
                    value={`${member.name} ${member.handle} ${member.id}`}
                    aria-label={`Manage ${memberName(member)}`}
                    aria-expanded={undefined}
                  >
                    {@render memberIdentity(member)}
                    <span
                      class="community-member-command__member-menu-icon"
                      data-ui-component="command-view"
                      data-ui-part="trailing"
                      aria-hidden="true"
                    >
                      <EllipsisIcon />
                    </span>
                  </CommandView.Item>
                {/snippet}
              </DropdownMenu.Trigger>
              <DropdownMenu.Content
                class="community-member-command__member-menu"
                align="end"
                sideOffset={4}
              >
                <DropdownMenu.Group>
                  {#if onSetRoles}
                    <DropdownMenu.Item onSelect={() => openRoleDialog(member)}>
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
            <CommandView.Item
              value={`${member.name} ${member.handle} ${member.id}`}
              aria-label={`${memberName(member)}, administrator`}
              onSelect={() => {}}
            >
              {@render memberIdentity(member)}
            </CommandView.Item>
          {:else}
            <CommandView.Item
              value={`${member.name} ${member.handle} ${member.id}`}
              data-selected-recipient={selectedIds.includes(member.id)
                ? ""
                : undefined}
              onSelect={() => onSelect(member)}
              disabled={disabled ||
                (mode === "select" &&
                  selectedIds.length >= maxSelected &&
                  !selectedIds.includes(member.id))}
            >
              {@render memberIdentity(member)}
              {#if mode === "select" && selectedIds.includes(member.id)}
                <span data-ui-component="command-view" data-ui-part="trailing">
                  <UserMinusIcon data-icon="inline-end" aria-hidden="true" />
                </span>
              {/if}
            </CommandView.Item>
          {/if}
        {/each}
      </CommandView.Group>
      {#if mode !== "select" && isSearching}
        <CommandView.Group heading={`Not in this ${roomNoun}`}>
          {#each otherMembers as member (member.id)}
            <CommandView.Item
              value={`${member.name} ${member.handle} ${member.id}`}
              aria-label={mode === "manage"
                ? `Add ${member.name} to ${roomNoun}`
                : undefined}
              onSelect={() => onSelect(member)}
            >
              {@render memberIdentity(member)}
              {#if mode === "manage"}
                <span
                  class="community-member-command__add"
                  data-ui-component="command-view"
                  data-ui-part="trailing"
                  aria-hidden="true">Add</span
                >
              {/if}
            </CommandView.Item>
          {/each}
        </CommandView.Group>
      {/if}
    </CommandView.List>
  </CommandView.Root>
{/snippet}

{#if presentation === "inline"}
  {@render memberCommand()}
{:else}
  <Dialog.Root bind:open>
    <DialogFrame
      {title}
      size="form"
      bodyPadding="none"
      closeLabel="Close members"
      aria-describedby={undefined}
      {...mode === "select" && onConfirm ? { footer: selectionFooter } : {}}
    >
      {@render memberCommand()}
    </DialogFrame>
  </Dialog.Root>
{/if}

<Dialog.Root bind:open={roleDialogOpen}>
  <DialogFrame title="Manage roles" size="form" aria-describedby={undefined}>
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
  :global(.community-member-command[data-ui-part="root"]) {
    --ui-command-view-list-max-height: min(33rem, calc(100dvh - 12rem));
    --ui-command-view-list-padding: 0.75rem;
    --ui-command-view-gap: 1rem;

    width: auto;
    margin: 0 1.5rem 1.5rem;
    border: 1px solid var(--border);
    border-radius: 1rem;
  }

  :global(
      .community-member-command.community-member-command--inline[data-ui-part="root"]
    ) {
    --ui-command-view-list-max-height: 10rem;
    --ui-command-view-list-padding: 0;
    width: 100%;
    margin: 0;
    padding: 0;
    min-width: 0;
  }

  .community-member-command__directory-notice {
    margin: 0;
    border-block-end: 1px solid var(--border);
    padding: 0.65rem 1rem;
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
  }

  .community-member-command__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    border-block-end: 1px solid var(--border);
    padding: 0.75rem 1rem;
  }

  :global(
      .community-member-command [data-ui-part="item"][data-selected-recipient]
    ) {
    background: var(--accent);
  }

  :global(.community-member-command__avatar[data-ui-part="item-icon"]) {
    width: 2.5rem;
    height: 2.5rem;
  }

  .community-member-command__member-heading {
    display: flex;
    min-width: 0;
    align-items: baseline;
    gap: 0.45rem;
  }

  .community-member-command__member-heading strong {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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

  .community-member-command__member-menu-icon {
    display: grid;
    width: 2rem;
    height: 2rem;
    place-items: center;
    border-radius: 0.7rem;
    background: var(--muted);
  }

  :global(.community-member-command__member-menu) {
    width: min(24rem, calc(100vw - 2rem));
    min-width: 15rem;
  }

  .community-member-command__add {
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
  }

  @media (max-width: 40rem) {
    :global(.community-member-command[data-ui-part="root"]) {
      margin-inline: 1rem;
    }
    :global(.community-member-command[data-presentation="inline"]) {
      margin-inline: 0;
    }
  }
</style>
