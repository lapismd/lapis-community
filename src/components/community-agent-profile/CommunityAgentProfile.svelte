<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Tabs from "@lapismd/design-core/shadcn/tabs";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as CommandView from "@lapismd/design-core/shadcn/command-view";
  import * as DropdownMenu from "@lapismd/design-core/shadcn/dropdown-menu";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import MessageIcon from "@lucide/svelte/icons/message-square";
  import FollowIcon from "@lucide/svelte/icons/user-plus";
  import ActivityIcon from "@lucide/svelte/icons/wrench";
  import FingerprintIcon from "@lucide/svelte/icons/fingerprint";
  import UserIcon from "@lucide/svelte/icons/user-round";
  import CpuIcon from "@lucide/svelte/icons/cpu";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import ArrowUpRightIcon from "@lucide/svelte/icons/arrow-up-right";
  import EllipsisIcon from "@lucide/svelte/icons/ellipsis";
  import HashIcon from "@lucide/svelte/icons/hash";
  import LockIcon from "@lucide/svelte/icons/lock";
  import CheckIcon from "@lucide/svelte/icons/check";
  import UserMinusIcon from "@lucide/svelte/icons/user-minus";
  import XIcon from "@lucide/svelte/icons/x";
  import type {
    CommunityAgentIdentity,
    CommunityAgentPresence,
  } from "../../community/agent-contracts.js";
  import type { CommunityRoomModel } from "../community-workspace/model.js";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import { communityAgentMember } from "../community-agents/model.js";

  let {
    agent,
    presence,
    working = false,
    rooms = [],
    canMessage = false,
    connected = true,
    ownerName,
    onOpenOwner,
    onMessage,
    onFollow,
    onActivity,
    onCopy,
    onOpenChannel,
    onAddChannel,
    onRemoveChannel,
  }: {
    agent: CommunityAgentIdentity;
    presence?: CommunityAgentPresence | undefined;
    working?: boolean;
    rooms?: readonly CommunityRoomModel[];
    canMessage?: boolean;
    connected?: boolean;
    ownerName?: string;
    onOpenOwner?: (pubkey: string) => void;
    onMessage: () => void | Promise<void>;
    onFollow: (following: boolean) => Promise<void>;
    onActivity: () => void;
    onCopy: () => void | Promise<void>;
    onOpenChannel: (id: string) => void;
    onAddChannel: (id: string) => Promise<void>;
    onRemoveChannel: (id: string) => Promise<void>;
  } = $props();
  let tab = $state("info");
  let pending = $state(false);
  let error = $state("");
  let addOpen = $state(false);
  let removeRoom = $state<CommunityRoomModel | undefined>();
  let selectedRoom = $state("");
  let channelQuery = $state("");
  let copied = $state(false);
  let addTrigger = $state<HTMLButtonElement | null>(null);
  let channelSearch = $state<HTMLInputElement | null>(null);
  let profile = $state<HTMLElement>();
  const profileId = $props.id();
  const channelSearchId = `${profileId}-channel-search`;
  const channels = $derived(
    rooms.filter(
      (room) =>
        room.kind !== "direct" &&
        agent.channelIds.includes(room.groupId ?? room.id),
    ),
  );
  const addable = $derived(
    rooms.filter(
      (room) =>
        room.kind !== "direct" &&
        !room.archived &&
        room.permissions?.manageMembers.state === "enabled" &&
        !agent.channelIds.includes(room.groupId ?? room.id),
    ),
  );
  const selectedChannel = $derived(
    addable.find((room) => room.id === selectedRoom),
  );
  async function action(run: () => void | Promise<void>) {
    pending = true;
    error = "";
    try {
      await run();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Agent action failed";
    } finally {
      pending = false;
    }
  }
</script>

<article
  bind:this={profile}
  tabindex="-1"
  class="agent-profile"
  aria-label={`${agent.name} agent profile`}
>
  <header>
    <CommunityMemberAvatar
      member={communityAgentMember(agent)}
      size="large"
      showPresence
      presence={presence?.status ?? "unknown"}
    />
    <h2>{agent.name}</h2>
    {#if working}<div class="agent-profile__signals">
        <CommunityChip size="compact" tone="accent">Working</CommunityChip>
      </div>{/if}
  </header>
  <div class="agent-profile__actions">
    <Button
      class="agent-profile__action"
      variant="secondary"
      disabled={!canMessage || !connected || pending}
      title={!canMessage
        ? "An encryption-capable signer is required for direct messages"
        : undefined}
      onclick={() => action(onMessage)}
      ><MessageIcon aria-hidden="true" />Message</Button
    >
    <Button
      class="agent-profile__action"
      variant="secondary"
      disabled={!connected || pending}
      aria-pressed={agent.followed}
      onclick={() => action(() => onFollow(!agent.followed))}
      ><FollowIcon aria-hidden="true" />{agent.followed
        ? "Unfollow"
        : "Follow"}</Button
    >
  </div>
  {#if !canMessage}<p>
      Connect a signer with encryption support to message this agent.
    </p>{/if}
  {#if !connected}<p>
      Reconnect to message agents or change their channels.
    </p>{/if}
  {#if error && !addOpen && !removeRoom}<p role="alert">{error}</p>{/if}
  <Tabs.Root bind:value={tab}>
    <Tabs.List class="agent-profile__tabs"
      ><Tabs.Trigger value="info">Info</Tabs.Trigger><Tabs.Trigger
        value="channels">Channels</Tabs.Trigger
      ></Tabs.List
    >
    <Tabs.Content value="info">
      <div class="agent-profile__info">
        <Button
          class="agent-profile__activity-link"
          variant="outline"
          aria-label="Activity log"
          onclick={onActivity}
          ><ActivityIcon aria-hidden="true" /><span>Activity log</span>
          <span class="agent-profile__view">View</span><ChevronRightIcon
            aria-hidden="true"
          /></Button
        >
        <section aria-label="Info">
          <h3>Info</h3>
          <ul class="agent-profile__info-list" aria-label="Agent information">
            {#if agent.about}<li class="agent-profile__info-row">
                <MessageIcon aria-hidden="true" />
                <div class="agent-profile__info-value">
                  <strong>About</strong>
                  <p>{agent.about}</p>
                </div>
              </li>{/if}
            <li>
              <Button
                class="agent-profile__info-row agent-profile__info-link"
                variant="ghost"
                aria-label={`Copy ${agent.name}'s public key`}
                onclick={() => action(onCopy)}
                ><FingerprintIcon aria-hidden="true" />
                <span class="agent-profile__info-value"
                  ><strong>Public key</strong><span class="agent-profile__key"
                    >{agent.pubkey.slice(0, 12)}…{agent.pubkey.slice(-8)}</span
                  ></span
                ><CopyIcon aria-hidden="true" /></Button
              >
            </li>
            <li>
              {#snippet ownerInfo()}
                <UserIcon aria-hidden="true" />
                <span class="agent-profile__info-value"
                  ><strong>Managed by</strong><span
                    >{ownerName ? `${ownerName} (you)` : "You"}</span
                  ></span
                >
              {/snippet}
              {#if onOpenOwner}
                <Button
                  class="agent-profile__info-row agent-profile__info-link"
                  variant="ghost"
                  aria-label={ownerName
                    ? `View ${ownerName}'s profile`
                    : "View your profile"}
                  onclick={() => onOpenOwner?.(agent.ownerPubkey)}
                  >{@render ownerInfo()}<ChevronRightIcon
                    aria-hidden="true"
                  /></Button
                >
              {:else}<div class="agent-profile__info-row">
                  {@render ownerInfo()}
                </div>{/if}
            </li>
            <li class="agent-profile__info-row">
              <CpuIcon aria-hidden="true" />
              <div class="agent-profile__info-value">
                <strong>Agent type</strong><span>{agent.agentType}</span>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </Tabs.Content>
    <Tabs.Content value="channels">
      <div class="agent-profile__channels">
        <div class="agent-profile__channel-group">
          <Button
            bind:ref={addTrigger}
            class="agent-profile__channel-link agent-profile__channel-add"
            variant="ghost"
            disabled={!connected || pending || addable.length === 0}
            onclick={() => {
              error = "";
              selectedRoom = "";
              channelQuery = "";
              copied = false;
              addOpen = true;
            }}
            ><FollowIcon aria-hidden="true" /><span>Add to channel</span
            ><ChevronRightIcon aria-hidden="true" /></Button
          >
          {#if channels.length === 0}<p class="agent-profile__channel-empty">
              No accessible channel memberships.
            </p>{/if}
          <ul aria-label="Agent channels">
            {#each channels as room (room.id)}<li
                class="agent-profile__channel"
              >
                <Button
                  class="agent-profile__channel-link"
                  variant="ghost"
                  aria-label={`Open #${room.name}`}
                  onclick={() => onOpenChannel(room.id)}
                  ><span>#{room.name}</span><ArrowUpRightIcon
                    aria-hidden="true"
                  /></Button
                >{#if room.permissions?.manageMembers.state === "enabled"}
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger>
                      {#snippet child({ props })}
                        <Button
                          {...props}
                          class="agent-profile__channel-menu"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Actions for ${room.name}`}
                          disabled={!connected || pending}
                        >
                          <EllipsisIcon aria-hidden="true" />
                        </Button>
                      {/snippet}
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content
                      class="agent-profile__channel-actions"
                      align="end"
                      onCloseAutoFocus={(event) => {
                        if (removeRoom) event.preventDefault();
                      }}
                    >
                      <DropdownMenu.Group>
                        <DropdownMenu.Item
                          variant="destructive"
                          onSelect={() => {
                            error = "";
                            removeRoom = room;
                          }}
                        >
                          <UserMinusIcon
                            data-icon="inline-start"
                            aria-hidden="true"
                          />Remove
                        </DropdownMenu.Item>
                      </DropdownMenu.Group>
                    </DropdownMenu.Content>
                  </DropdownMenu.Root>
                {/if}
              </li>{/each}
          </ul>
        </div>
        {#if addable.length === 0}<p>
            You can manage agent memberships in channels where you have
            permission.
          </p>{/if}
      </div>
    </Tabs.Content>
  </Tabs.Root>
</article>

<Dialog.Root bind:open={addOpen}>
  <Dialog.Content
    class="agent-profile__add-dialog"
    showCloseButton={false}
    onOpenAutoFocus={(event) => {
      event.preventDefault();
      channelSearch?.focus({ preventScroll: true });
    }}
    onCloseAutoFocus={(event) => {
      event.preventDefault();
      (addTrigger && !addTrigger.disabled ? addTrigger : profile)?.focus({
        preventScroll: true,
      });
    }}
    onInteractOutside={(event) => {
      if (pending) event.preventDefault();
    }}
    onEscapeKeydown={(event) => {
      if (pending) event.preventDefault();
    }}
    ><Dialog.Header
      ><Dialog.Title>Add agent to channel</Dialog.Title><Dialog.Description
        >Add {agent.name} to a channel so members can include it in the conversation.</Dialog.Description
      ></Dialog.Header
    >
    <Button
      class="agent-profile__close"
      variant="ghost"
      size="icon-sm"
      aria-label="Close add agent dialog"
      disabled={pending}
      onclick={() => (addOpen = false)}
      ><XIcon class="size-3.5" aria-hidden="true" /></Button
    >
    <div class="agent-profile__add-body">
      <Field.Group>
        <Field.Field>
          <Field.Label for={channelSearchId}>Channel</Field.Label>
          <div class="agent-profile__channel-picker">
            <CommandView.Root label="Search channels" loop>
              <CommandView.Input
                id={channelSearchId}
                bind:ref={channelSearch}
                bind:value={channelQuery}
                aria-label="Search channels"
                placeholder="Search channels…"
                disabled={pending}
              />
              <CommandView.List>
                <CommandView.Empty>No matching channels.</CommandView.Empty>
                <CommandView.Group heading="Available channels">
                  {#each addable as room (room.id)}
                    <CommandView.Item
                      value={room.id}
                      keywords={[room.name]}
                      disabled={pending || !connected}
                      data-active={selectedRoom === room.id ? "" : undefined}
                      onSelect={() => {
                        selectedRoom = room.id;
                        error = "";
                      }}
                    >
                      <CommandView.ItemIcon
                        >{#if room.private}<LockIcon
                            aria-hidden="true"
                          />{:else}<HashIcon
                            aria-hidden="true"
                          />{/if}</CommandView.ItemIcon
                      >
                      <CommandView.ItemLabel>{room.name}</CommandView.ItemLabel>
                      <CommandView.ItemDescription
                        ><CommunityChip size="compact" tone="neutral"
                          >{room.private
                            ? "Private"
                            : room.kind === "forum"
                              ? "Forum"
                              : "Channel"}</CommunityChip
                        ></CommandView.ItemDescription
                      >
                      {#if selectedRoom === room.id}<CheckIcon
                          class="agent-profile__selected-icon"
                          aria-label="Selected"
                        />{/if}
                    </CommandView.Item>
                  {/each}
                </CommandView.Group>
              </CommandView.List>
            </CommandView.Root>
          </div>
          <Field.Description
            >{selectedChannel
              ? `Selected channel: #${selectedChannel.name}`
              : "Choose a channel where you can manage members."}</Field.Description
          >
        </Field.Field>
        <Field.Field class="agent-profile__agent-key">
          <Field.Title>Agent public key</Field.Title>
          <div class="agent-profile__key-copy">
            <code>{agent.pubkey}</code>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onclick={() =>
                action(async () => {
                  await onCopy();
                  copied = true;
                })}
              ><CopyIcon aria-hidden="true" />{copied
                ? "Copied"
                : "Copy public key"}</Button
            >
          </div>
        </Field.Field>
      </Field.Group>
      {#if error}<p role="alert">{error}</p>{/if}
    </div>
    <Dialog.Footer
      ><Button
        variant="outline"
        disabled={pending}
        onclick={() => (addOpen = false)}>Cancel</Button
      ><Button
        disabled={pending || !connected || !selectedChannel}
        onclick={() =>
          action(async () => {
            if (!selectedChannel) return;
            await onAddChannel(selectedChannel.id);
            addOpen = false;
          })}>{pending ? "Adding…" : "Add to channel"}</Button
      ></Dialog.Footer
    >
  </Dialog.Content>
</Dialog.Root>
<Dialog.Root
  open={removeRoom !== undefined}
  onOpenChange={(open) => {
    if (!open) removeRoom = undefined;
  }}
>
  <Dialog.Content showCloseButton={false}
    ><Dialog.Header
      ><Dialog.Title>Remove {agent.name} from {removeRoom?.name}?</Dialog.Title
      ><Dialog.Description
        >The agent will lose access to this channel. You can add it again later
        if permitted.</Dialog.Description
      ></Dialog.Header
    >
    <Button
      class="agent-profile__close"
      variant="ghost"
      size="icon-sm"
      aria-label="Close remove agent dialog"
      onclick={() => (removeRoom = undefined)}
      ><XIcon class="size-3.5" aria-hidden="true" /></Button
    >
    {#if error}<p role="alert">{error}</p>{/if}<Dialog.Footer
      ><Button
        variant="outline"
        disabled={pending}
        onclick={() => (removeRoom = undefined)}>Cancel</Button
      ><Button
        variant="destructive"
        disabled={pending}
        onclick={() =>
          action(async () => {
            if (!removeRoom) return;
            await onRemoveChannel(removeRoom.id);
            removeRoom = undefined;
          })}>{pending ? "Removing…" : "Remove agent"}</Button
      ></Dialog.Footer
    >
  </Dialog.Content>
</Dialog.Root>

<style>
  .agent-profile {
    padding: 1.25rem;
    display: grid;
    gap: 1.5rem;
  }
  header {
    display: grid;
    justify-items: center;
    gap: 0.875rem;
    padding: 1.5rem 0 0.5rem;
  }
  h2,
  h3,
  p {
    margin: 0;
  }
  h2 {
    font-size: 1.5rem;
    font-weight: 650;
    text-align: center;
  }
  h3 {
    font-size: 0.85rem;
    font-weight: 600;
  }
  p {
    color: var(--muted-foreground);
    line-height: 1.6;
    overflow-wrap: anywhere;
  }
  .agent-profile__signals,
  .agent-profile__actions {
    display: flex;
    gap: 0.625rem;
    justify-content: center;
    flex-wrap: wrap;
  }
  .agent-profile__actions :global(button) {
    flex: 1;
    min-height: 4rem;
    flex-direction: column;
    gap: 0.5rem;
  }
  :global(.agent-profile__action.agent-profile__action:hover:not(:disabled)),
  :global(
      .agent-profile__action.agent-profile__action:focus-visible:not(:disabled)
    ) {
    background: color-mix(in oklab, var(--primary) 14%, var(--secondary));
    color: var(--foreground);
    box-shadow: inset 0 0 0 1px
      color-mix(in oklab, var(--primary) 32%, transparent);
  }
  :global(.agent-profile__action.agent-profile__action:focus-visible) {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }
  :global(.agent-profile__tabs) {
    width: 100%;
  }
  :global(.agent-profile__tabs > button) {
    flex: 1;
  }
  .agent-profile__info,
  .agent-profile__channels {
    display: grid;
    gap: 1.25rem;
    padding-top: 1rem;
  }
  section {
    display: grid;
    gap: 0.875rem;
  }
  .agent-profile__info-list {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 1rem;
    overflow: hidden;
  }
  .agent-profile__info-list > li + li {
    border-top: 1px solid var(--border);
  }
  :global(.agent-profile__info-row),
  :global(.agent-profile__activity-link) {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 1.125rem 1rem;
    min-height: 4.5rem;
    width: 100%;
    height: auto;
    text-align: left;
    white-space: normal;
  }
  :global(.agent-profile__info-link) {
    border-radius: 0;
    justify-content: flex-start;
  }
  .agent-profile__info-value {
    display: grid;
    flex: 1;
    min-width: 0;
    gap: 0.25rem;
    font-weight: 400;
    overflow-wrap: anywhere;
  }
  .agent-profile__info-value strong {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--foreground);
  }
  .agent-profile__info-value > span,
  .agent-profile__view {
    color: var(--muted-foreground);
  }
  :global(.agent-profile__info-row > svg) {
    width: 1.125rem;
    height: 1.125rem;
    flex-shrink: 0;
  }
  :global(.agent-profile__activity-link) {
    border-radius: 1rem;
    box-shadow: none;
    justify-content: flex-start;
  }
  :global(.agent-profile__activity-link > span:first-of-type) {
    flex: 1;
  }
  .agent-profile__key {
    font-family: var(--font-mono, monospace);
    font-size: 0.8rem;
  }
  .agent-profile__channel {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid var(--border);
  }
  .agent-profile__channel-group {
    --ui-button-radius: 0;
    border: 1px solid var(--border);
    border-radius: 1rem;
    overflow: hidden;
  }
  .agent-profile__channel-group ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  :global(.agent-profile__channel-link) {
    flex: 1;
    min-width: 0;
    width: 100%;
    height: auto;
    min-height: 4rem;
    justify-content: space-between;
    gap: 0.875rem;
    padding: 1rem;
    text-align: left;
  }
  :global(.agent-profile__channel-link > span) {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  :global(.agent-profile__channel-menu) {
    margin-right: 0.625rem;
    border-radius: 0.5rem;
    color: var(--muted-foreground);
  }
  :global(.agent-profile__channel-actions) {
    width: 12rem;
    max-width: calc(100vw - 2rem);
  }
  .agent-profile__channel-empty {
    padding: 1rem;
    border-top: 1px solid var(--border);
  }
  :global(.agent-profile__add-dialog) {
    display: flex;
    flex-direction: column;
    gap: 0;
    width: min(36rem, calc(100vw - 2rem));
    max-width: calc(100vw - 2rem);
    max-height: calc(100dvh - 2rem);
    padding: 0;
    overflow: hidden;
  }
  :global(.agent-profile__add-dialog > [data-slot="dialog-header"]) {
    padding: 1.5rem 3rem 1.25rem 1.5rem;
    border-bottom: 1px solid var(--border);
  }
  :global(.agent-profile__add-dialog > [data-slot="dialog-footer"]) {
    padding: 1.125rem 1.5rem;
    border-top: 1px solid var(--border);
  }
  .agent-profile__add-body {
    min-height: 0;
    overflow-y: auto;
    padding: 1.5rem;
    display: grid;
    gap: 1rem;
  }
  .agent-profile__channel-picker {
    --ui-command-view-list-max-height: 12rem;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    overflow: hidden;
  }
  :global(.agent-profile__selected-icon) {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }
  :global(.agent-profile__agent-key) {
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    padding: 1rem;
  }
  .agent-profile__key-copy {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .agent-profile__key-copy code {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
    font-size: 0.75rem;
    line-height: 1.6;
  }
  @media (max-width: 480px) {
    .agent-profile__key-copy {
      flex-direction: column;
      align-items: flex-start;
    }
    .agent-profile__add-body {
      padding: 1rem;
    }
  }
  :global(.agent-profile__close) {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    border-radius: 0.5rem;
  }
</style>
