<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Tabs from "@lapismd/design-core/shadcn/tabs";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as Select from "@lapismd/design-core/shadcn/select";
  import MessageIcon from "@lucide/svelte/icons/message-square";
  import FollowIcon from "@lucide/svelte/icons/user-plus";
  import ActivityIcon from "@lucide/svelte/icons/activity";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import PlusIcon from "@lucide/svelte/icons/plus";
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
        room.permissions?.manageMembers.state === "enabled" &&
        !agent.channelIds.includes(room.groupId ?? room.id),
    ),
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

<article class="agent-profile" aria-label={`${agent.name} agent profile`}>
  <header>
    <CommunityMemberAvatar member={communityAgentMember(agent)} size="large" />
    <h2>{agent.name}</h2>
    <div class="agent-profile__signals">
      <CommunityChip
        size="compact"
        tone={presence?.status === "online" ? "success" : "neutral"}
        >{presence?.status === "online"
          ? "Online"
          : "Presence unknown"}</CommunityChip
      >{#if working}<CommunityChip size="compact" tone="accent"
          >Working</CommunityChip
        >{/if}
    </div>
  </header>
  <div class="agent-profile__actions">
    <Button
      variant="secondary"
      disabled={!canMessage || !connected || pending}
      title={!canMessage
        ? "An encryption-capable signer is required for direct messages"
        : undefined}
      onclick={() => action(onMessage)}
      ><MessageIcon aria-hidden="true" />Message</Button
    >
    <Button
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
        <Button variant="outline" onclick={onActivity}
          ><ActivityIcon aria-hidden="true" />Activity log</Button
        >
        {#if agent.about}<section>
            <h3>About</h3>
            <p>{agent.about}</p>
          </section>{/if}
        <dl>
          <div>
            <dt>Public key</dt>
            <dd>
              <Button
                variant="ghost"
                aria-label={`Copy ${agent.name}'s public key`}
                onclick={() => action(onCopy)}
                ><span class="agent-profile__key"
                  >{agent.pubkey.slice(0, 12)}…{agent.pubkey.slice(-8)}</span
                ><CopyIcon aria-hidden="true" /></Button
              >
            </dd>
          </div>
          <div>
            <dt>Managed by</dt>
            <dd>
              You <span class="agent-profile__key"
                >({agent.ownerPubkey.slice(0, 8)}…{agent.ownerPubkey.slice(
                  -4,
                )})</span
              >
            </dd>
          </div>
          <div>
            <dt>Agent type</dt>
            <dd>{agent.agentType}</dd>
          </div>
        </dl>
      </div>
    </Tabs.Content>
    <Tabs.Content value="channels">
      <div class="agent-profile__channels">
        <Button
          variant="outline"
          disabled={!connected || addable.length === 0}
          onclick={() => {
            error = "";
            selectedRoom = addable[0]?.id ?? "";
            addOpen = true;
          }}><PlusIcon aria-hidden="true" />Add to channel</Button
        >
        {#if channels.length === 0}<p>
            No accessible channel memberships.
          </p>{/if}
        {#each channels as room (room.id)}<div class="agent-profile__channel">
            <Button variant="ghost" onclick={() => onOpenChannel(room.id)}
              ># {room.name}</Button
            >{#if room.permissions?.manageMembers.state === "enabled"}<Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${agent.name} from ${room.name}`}
                disabled={!connected || pending}
                onclick={() => {
                  error = "";
                  removeRoom = room;
                }}><XIcon aria-hidden="true" /></Button
              >{/if}
          </div>{/each}
        {#if addable.length === 0}<p>
            You can manage agent memberships in channels where you have
            permission.
          </p>{/if}
      </div>
    </Tabs.Content>
  </Tabs.Root>
</article>

<Dialog.Root bind:open={addOpen}>
  <Dialog.Content showCloseButton={false}
    ><Dialog.Header
      ><Dialog.Title>Add {agent.name} to a channel</Dialog.Title
      ><Dialog.Description
        >Choose a channel where you can manage members.</Dialog.Description
      ></Dialog.Header
    >
    <Button
      class="agent-profile__close"
      variant="ghost"
      size="icon-sm"
      aria-label="Close add agent dialog"
      onclick={() => (addOpen = false)}
      ><XIcon class="size-3.5" aria-hidden="true" /></Button
    >
    <Select.Root type="single" bind:value={selectedRoom}
      ><Select.Trigger aria-label="Channel"
        >{addable.find((room) => room.id === selectedRoom)?.name ??
          "Choose a channel"}</Select.Trigger
      ><Select.Content
        >{#each addable as room (room.id)}<Select.Item
            value={room.id}
            label={room.name}>{room.name}</Select.Item
          >{/each}</Select.Content
      ></Select.Root
    >
    {#if error}<p role="alert">{error}</p>{/if}<Dialog.Footer
      ><Button
        variant="outline"
        disabled={pending}
        onclick={() => (addOpen = false)}>Cancel</Button
      ><Button
        disabled={pending || !selectedRoom}
        onclick={() =>
          action(async () => {
            await onAddChannel(selectedRoom);
            addOpen = false;
          })}>{pending ? "Adding…" : "Add agent"}</Button
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
  h3,
  dt {
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
    gap: 0.4rem;
  }
  dl {
    display: grid;
    margin: 0;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    overflow: hidden;
  }
  dl > div {
    padding: 1rem;
    display: grid;
    gap: 0.4rem;
  }
  dl > div + div {
    border-top: 1px solid var(--border);
  }
  dd {
    margin: 0;
    color: var(--muted-foreground);
    overflow-wrap: anywhere;
  }
  .agent-profile__key {
    font-family: var(--font-mono, monospace);
    font-size: 0.8rem;
  }
  .agent-profile__channel {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    align-items: center;
  }
  :global(.agent-profile__close) {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    border-radius: 0.5rem;
  }
</style>
