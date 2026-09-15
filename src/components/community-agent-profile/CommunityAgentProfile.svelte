<script lang="ts">
  import CommunityProjectChannelIcon from "../community-project-channel-icon/CommunityProjectChannelIcon.svelte";
  import type { CommunityMemberModel } from "../community-workspace/model.js";
  import CommunityAgentProcessingControl from "../community-agent-processing-control/CommunityAgentProcessingControl.svelte";
  import {
    ConfirmDialog,
    DialogFrame,
  } from "@lapismd/design-core/forms/dialog";
  import {
    FilterCommandPicker,
    type FilterCommandOption,
  } from "@lapismd/design-core/forms/filter-command-picker";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Tabs from "@lapismd/design-core/shadcn/tabs";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as CommandView from "@lapismd/design-core/shadcn/command-view";
  import * as Collapsible from "@lapismd/design-core/shadcn/collapsible";
  import * as DropdownMenu from "@lapismd/design-core/shadcn/dropdown-menu";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import { SearchFilterBar } from "@lapismd/design-core/filter";
  import MessageIcon from "@lucide/svelte/icons/message-square";
  import FollowIcon from "@lucide/svelte/icons/user-plus";
  import ActivityIcon from "@lucide/svelte/icons/wrench";
  import FingerprintIcon from "@lucide/svelte/icons/fingerprint";
  import UserIcon from "@lucide/svelte/icons/user-round";
  import CpuIcon from "@lucide/svelte/icons/cpu";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import ArrowUpRightIcon from "@lucide/svelte/icons/arrow-up-right";
  import EllipsisIcon from "@lucide/svelte/icons/ellipsis";
  import HashIcon from "@lucide/svelte/icons/hash";
  import LockIcon from "@lucide/svelte/icons/lock";
  import CheckIcon from "@lucide/svelte/icons/check";
  import CircleCheckIcon from "@lucide/svelte/icons/circle-check";
  import CircleXIcon from "@lucide/svelte/icons/circle-x";
  import UserMinusIcon from "@lucide/svelte/icons/user-minus";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import XIcon from "@lucide/svelte/icons/x";
  import BrainIcon from "@lucide/svelte/icons/brain";
  import RotateCwIcon from "@lucide/svelte/icons/rotate-cw";
  import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
  import type {
    CommunityAgentIdentity,
    CommunityAgentMemoryState,
    CommunityAgentPersona,
    CommunityAgentPresence,
    CommunityAgentRuntimeState,
    CommunityAgentProcessingState,
    CommunityAgentSaveInput,
  } from "../../community/agent-contracts.js";
  import type { CommunityRoomModel } from "../community-workspace/model.js";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunityAgentEditorDialog from "../community-agent-editor/CommunityAgentEditorDialog.svelte";
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import { communityAgentMember } from "../community-agents/model.js";

  let {
    agent,
    members = [],
    memberResults = [],
    onSearchMembers,
    personas = [],
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
    onSaveAgent,
    onUnlinkPersona,
    onDeletePersona,
    runtime,
    processing,
    onLoadProcessing,
    onSetProcessing,
    memories,
    onLoadRuntime,
    onSaveRuntime,
    onLoadMemories,
    onActOnMemory,
  }: {
    agent: CommunityAgentIdentity;
    members?: readonly CommunityMemberModel[];
    memberResults?: readonly CommunityMemberModel[];
    onSearchMembers?: ((query: string) => void) | undefined;
    personas?: readonly CommunityAgentPersona[];
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
    onSaveAgent: (input: CommunityAgentSaveInput) => Promise<void>;
    onUnlinkPersona: (fallbackName: string) => Promise<void>;
    onDeletePersona: (slug: string) => Promise<void>;
    processing?: CommunityAgentProcessingState | undefined;
    onLoadProcessing?:
      | (() => Promise<CommunityAgentProcessingState>)
      | undefined;
    onSetProcessing?:
      | ((
          enabled: boolean,
          revision: number,
        ) => Promise<CommunityAgentProcessingState>)
      | undefined;
    runtime?: CommunityAgentRuntimeState | undefined;
    memories?: CommunityAgentMemoryState | undefined;
    onLoadRuntime?: () => Promise<CommunityAgentRuntimeState>;
    onSaveRuntime?: (input: {
      runtimeAgent?: string;
      model?: string;
      thinking?: "off" | "low" | "medium" | "high";
    }) => Promise<CommunityAgentRuntimeState>;
    onLoadMemories?: (input: {
      channelId: string;
      status?: "approved" | "review" | "rejected" | "retracted";
      query?: string;
    }) => Promise<CommunityAgentMemoryState>;
    onActOnMemory?: (input: {
      channelId: string;
      action: "approve" | "reject" | "retract";
      candidateId?: string;
      memoryId?: string;
    }) => Promise<CommunityAgentMemoryState>;
  } = $props();
  let tab = $state("info");
  let pending = $state(false);
  let error = $state("");
  let addOpen = $state(false);
  let removeRoom = $state<CommunityRoomModel | undefined>();
  let selectedRoom = $state("");
  let channelQuery = $state("");
  let copied = $state(false);
  let personaOpen = $state(false);
  let addTrigger = $state<HTMLButtonElement | null>(null);
  let channelSearch = $state<HTMLInputElement | null>(null);
  let profile = $state<HTMLElement>();
  let runtimeAgent = $state("");
  let runtimeModel = $state("");
  let runtimeThinking = $state<"off" | "low" | "medium" | "high">("medium");
  let runtimeToolsOpen = $state(false);
  let runtimeLoaded = $state("");
  let runtimeRequested = $state("");
  let memoryChannel = $state("");
  let memoryStatus = $state<"approved" | "review" | "rejected" | "retracted">(
    "review",
  );
  let memoryQuery = $state("");
  let memoryFiltersExpanded = $state(false);
  let memoryLoaded = $state("");
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
  const runtimeAgents = $derived(
    runtime?.runtimeAgents.length
      ? runtime.runtimeAgents
      : runtime
        ? [
            {
              id: runtime.effective.runtimeAgent,
              label: runtime.effective.runtimeAgent,
            },
          ]
        : [],
  );
  const modelOptions = $derived.by(() => {
    const option = runtime?.catalog.configOptions.find(
      ({ id, category }) => id === "model" || category === "model",
    );
    return (
      option?.options ??
      runtime?.catalog.models.map((value) => ({ value, name: value })) ??
      []
    );
  });
  const thinkingOptions = $derived.by(() => {
    const option = runtime?.catalog.configOptions.find(
      ({ id, category }) =>
        category === "thought" ||
        ["thought_level", "thinking", "effort", "reasoning_effort"].includes(
          id,
        ),
    );
    return (
      option?.options?.filter(
        ({ value }) =>
          value === "off" ||
          value === "low" ||
          value === "medium" ||
          value === "high",
      ) ?? []
    );
  });
  const runtimeAgentLabel = $derived(
    runtimeAgents.find(({ id }) => id === runtimeAgent)?.label ?? runtimeAgent,
  );
  const runtimeModelLabel = $derived(
    (modelOptions.find(({ value }) => value === runtimeModel)?.name ??
      runtimeModel) ||
      "Harness default",
  );
  const runtimeThinkingLabel = $derived(
    thinkingOptions.find(({ value }) => value === runtimeThinking)?.name ??
      runtimeThinking,
  );
  const memoryRecords = $derived(
    memories?.channelId === memoryChannel
      ? memories.records.filter((record) => {
          const statusMatches =
            (memoryStatus === "approved" &&
              ((record.type === "candidate" && record.status === "approved") ||
                (record.type === "memory" && record.status === "active"))) ||
            (memoryStatus === "review" &&
              record.type === "candidate" &&
              record.status === "review") ||
            (memoryStatus === "rejected" &&
              record.type === "candidate" &&
              record.status === "rejected") ||
            (memoryStatus === "retracted" &&
              record.type === "memory" &&
              record.status === "retracted");
          const query = memoryQuery.trim().toLowerCase();
          return (
            statusMatches &&
            (!query ||
              (record.type === "candidate" ? record.claim : record.content)
                .toLowerCase()
                .includes(query))
          );
        })
      : [],
  );
  const memoryStatusOptions = [
    { value: "review", label: "Needs review" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
    { value: "retracted", label: "Retracted" },
  ] as const;
  const selectedMemoryChannelLabel = $derived(
    channels.find((room) => (room.groupId ?? room.id) === memoryChannel)
      ?.name ?? "Select channel",
  );
  const selectedMemoryStatusLabel = $derived(
    memoryStatusOptions.find((option) => option.value === memoryStatus)
      ?.label ?? "Needs review",
  );
  const memoryChannelOptions = $derived<FilterCommandOption[]>(
    channels.map((room) => ({
      value: room.groupId ?? room.id,
      label: `#${room.name}`,
      description: room.private ? "Private channel" : "Public channel",
      keywords: [room.id, room.groupId ?? "", room.name],
    })),
  );
  const memoryStatusPickerOptions = $derived<FilterCommandOption[]>(
    memoryStatusOptions.map((option) => ({
      value: option.value,
      label: option.label,
      description:
        option.value === "review"
          ? "Awaiting owner decision"
          : option.value === "approved"
            ? "Accepted memory"
            : option.value === "rejected"
              ? "Dismissed suggestion"
              : "Removed memory",
    })),
  );
  const memoryRequestKey = $derived(
    `${agent.pubkey}:${memoryChannel}:${memoryStatus}:${memoryQuery.trim()}`,
  );

  $effect(() => {
    if (runtime && runtimeLoaded !== `${agent.pubkey}:${runtime.agentId}`) {
      runtimeAgent = runtime.effective.runtimeAgent;
      runtimeModel =
        runtime.effective.model ?? runtime.catalog.currentModel ?? "";
      runtimeThinking = (runtime.effective.thinking ??
        "medium") as typeof runtimeThinking;
      runtimeLoaded = `${agent.pubkey}:${runtime.agentId}`;
    }
  });

  $effect(() => {
    if (!memoryChannel && channels.length > 0)
      memoryChannel = channels[0]!.groupId ?? channels[0]!.id;
  });

  $effect(() => {
    if (
      tab === "runtime" &&
      onLoadRuntime &&
      runtimeRequested !== agent.pubkey
    ) {
      runtimeRequested = agent.pubkey;
      void loadRuntime();
    }
  });

  $effect(() => {
    if (
      tab !== "memories" ||
      !onLoadMemories ||
      !memoryChannel ||
      memoryLoaded === memoryRequestKey
    )
      return;
    const timeout = window.setTimeout(
      () => {
        memoryLoaded = memoryRequestKey;
        void loadMemories();
      },
      memoryQuery.trim() ? 300 : 0,
    );
    return () => window.clearTimeout(timeout);
  });

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

  async function loadRuntime(): Promise<void> {
    if (!onLoadRuntime) return;
    await action(async () => {
      const next = await onLoadRuntime();
      runtimeAgent = next.effective.runtimeAgent;
      runtimeModel = next.effective.model ?? next.catalog.currentModel ?? "";
      runtimeThinking = (next.effective.thinking ??
        "medium") as typeof runtimeThinking;
      runtimeLoaded = `${agent.pubkey}:${next.agentId}`;
    });
  }

  async function loadMemories(): Promise<void> {
    if (!onLoadMemories || !memoryChannel) return;
    await action(async () => {
      await onLoadMemories({
        channelId: memoryChannel,
        status: memoryStatus,
        ...(memoryQuery.trim() ? { query: memoryQuery.trim() } : {}),
      });
      memoryLoaded = memoryRequestKey;
    });
  }

  async function actOnMemory(input: {
    action: "approve" | "reject" | "retract";
    candidateId?: string;
    memoryId?: string;
  }): Promise<void> {
    if (!onActOnMemory || !memoryChannel) return;
    await action(async () => {
      await onActOnMemory({ channelId: memoryChannel, ...input });
      await onLoadMemories?.({
        channelId: memoryChannel,
        status: memoryStatus,
        ...(memoryQuery.trim() ? { query: memoryQuery.trim() } : {}),
      });
      memoryLoaded = memoryRequestKey;
    });
  }

  function openPersonaEditor(): void {
    error = "";
    personaOpen = true;
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
      shape="rounded"
      showPresence
      presence={presence?.status ?? "unknown"}
    />

    <h2>
      <Button
        type="button"
        variant="ghost"
        class="agent-profile__name-edit"
        aria-label={`Edit ${agent.name}`}
        disabled={!connected || pending}
        onclick={openPersonaEditor}
      >
        <span>{agent.name}</span>
        <span class="agent-profile__name-edit-icon" aria-hidden="true"
          ><PencilIcon /></span
        >
      </Button>
    </h2>
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
    {#if onLoadProcessing && onSetProcessing}<CommunityAgentProcessingControl
        presentation="profile"
        agentPubkey={agent.pubkey}
        state={processing}
        {connected}
        onLoad={onLoadProcessing}
        onSet={onSetProcessing}
      />{/if}
  </div>
  {#if !canMessage}<p>
      Connect a signer with encryption support to message this agent.
    </p>{/if}
  {#if !connected}<p>
      Reconnect to message agents or change their channels.
    </p>{/if}
  {#if error && !addOpen && !personaOpen && !removeRoom}<p role="alert">
      {error}
    </p>{/if}
  <Tabs.Root bind:value={tab}>
    <Tabs.List class="agent-profile__tabs"
      ><Tabs.Trigger value="info">Info</Tabs.Trigger><Tabs.Trigger
        value="channels">Channels</Tabs.Trigger
      >{#if onLoadRuntime}<Tabs.Trigger value="runtime">Runtime</Tabs.Trigger
        >{/if}{#if onLoadMemories}<Tabs.Trigger value="memories"
          >Memories</Tabs.Trigger
        >{/if}</Tabs.List
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
    {#if onLoadRuntime}<Tabs.Content value="runtime">
        <div class="agent-profile__runtime">
          <div class="agent-profile__section-heading">
            <div>
              <h3>Runtime</h3>
              <p>Harness settings apply to the next agent session.</p>
            </div>
            <div class="agent-profile__section-actions">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Refresh runtime details"
                disabled={!connected || pending}
                onclick={loadRuntime}
                ><RotateCwIcon aria-hidden="true" /></Button
              >
            </div>
          </div>
          {#if runtime}
            <dl class="agent-profile__runtime-summary">
              <div>
                <dt>Host</dt>
                <dd>{runtime.host.id}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{runtime.host.kind}</dd>
              </div>
              {#if runtime.host.workspace}<div>
                  <dt>Workspace</dt>
                  <dd class="agent-profile__key">{runtime.host.workspace}</dd>
                </div>{/if}
              <div>
                <dt>Bootstrap</dt>
                <dd>{runtime.bootstrapRevision ?? "Current configuration"}</dd>
              </div>
              <div>
                <dt>Memory</dt>
                <dd>
                  {runtime.memory.enabled
                    ? `${runtime.memory.candidates} candidate${runtime.memory.candidates === 1 ? "" : "s"}`
                    : "Disabled"}
                </dd>
              </div>
            </dl>
            <h3 class="agent-profile__runtime-config-title">
              Agent configuration
            </h3>
            <div
              class="agent-profile__runtime-fields"
              data-ui-part="runtime-defaults"
              aria-label="Runtime defaults"
            >
              <Button
                type="button"
                variant="ghost"
                class="agent-profile__runtime-field"
                disabled={!connected || pending || !onSaveRuntime}
                aria-label="Edit agent harness"
                onclick={openPersonaEditor}
              >
                <span>
                  <span>Agent harness</span>
                  <strong>{runtimeAgentLabel}</strong>
                </span>
                <PencilIcon aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                class="agent-profile__runtime-field"
                disabled={!connected || pending || !onSaveRuntime}
                aria-label="Edit model"
                onclick={openPersonaEditor}
              >
                <span>
                  <span>Model</span>
                  <strong>{runtimeModelLabel}</strong>
                </span>
                <PencilIcon aria-hidden="true" />
              </Button>
              {#if thinkingOptions.length > 0}
                <Button
                  type="button"
                  variant="ghost"
                  class="agent-profile__runtime-field"
                  disabled={!connected || pending || !onSaveRuntime}
                  aria-label="Edit thinking"
                  onclick={openPersonaEditor}
                >
                  <span>
                    <span>Thinking</span>
                    <strong>{runtimeThinkingLabel}</strong>
                  </span>
                  <PencilIcon aria-hidden="true" />
                </Button>
              {/if}
            </div>
            {#if runtime.catalog.error}<p role="alert">
                {runtime.catalog.error}
              </p>{/if}
            <Collapsible.Root
              class="agent-profile__tools"
              data-ui-part="runtime-tools"
              bind:open={runtimeToolsOpen}
            >
              <Collapsible.Trigger class="agent-profile__tools-trigger">
                <span>Tools</span>
                {#if runtimeToolsOpen}<ChevronDownIcon aria-hidden="true" />
                {:else}<ChevronRightIcon aria-hidden="true" />{/if}
              </Collapsible.Trigger>
              <Collapsible.Content class="agent-profile__tools-content">
                <div class="agent-profile__tool-list">
                  {#each runtime.tools as tool (tool.name)}<CommunityChip
                      size="compact"
                      tone={tool.effect === "write" ? "warning" : "neutral"}
                      >{tool.name}</CommunityChip
                    >{/each}
                </div>
              </Collapsible.Content>
            </Collapsible.Root>
          {:else}<p>
              {pending
                ? "Loading runtime…"
                : "Runtime details are unavailable."}
            </p>{/if}
        </div>
      </Tabs.Content>{/if}
    {#if onLoadMemories}<Tabs.Content value="memories">
        <div class="agent-profile__memories">
          <div class="agent-profile__section-heading">
            <div>
              <h3>Memories</h3>
              <p>Review memory saved for one channel.</p>
            </div>
            <BrainIcon aria-hidden="true" />
          </div>
          {#if channels.length > 0}
            <div class="agent-profile__memory-search">
              <SearchFilterBar
                value={memoryQuery}
                placeholder="Search memories"
                ariaLabel="Search memories"
                showFilterToggle
                bind:filtersExpanded={memoryFiltersExpanded}
                expandFiltersLabel="Filter memories"
                collapseFiltersLabel="Hide memory filters"
                clearSearchLabel="Clear memory search"
                onValueChange={(value) => (memoryQuery = value.slice(0, 256))}
                onClearSearch={() => {
                  memoryQuery = "";
                }}
              >
                {#snippet collapsedFilters()}
                  <span class="agent-profile__memory-filter-summary">
                    #{selectedMemoryChannelLabel}
                    <span>{selectedMemoryStatusLabel}</span>
                  </span>
                {/snippet}
                {#snippet filters()}
                  <div class="agent-profile__memory-filter-buttons">
                    <FilterCommandPicker
                      value={memoryChannel}
                      label="Channel"
                      ariaLabel="Choose memory channel"
                      placeholder="Search channels..."
                      emptyLabel="No matching channels."
                      options={memoryChannelOptions}
                      onChange={(value) => {
                        memoryChannel = value;
                        memoryLoaded = "";
                      }}
                    />
                    <FilterCommandPicker
                      value={memoryStatus}
                      label="Status"
                      ariaLabel="Choose memory status"
                      placeholder="Search statuses..."
                      emptyLabel="No matching statuses."
                      options={memoryStatusPickerOptions}
                      onChange={(value) => {
                        memoryStatus = value as typeof memoryStatus;
                        memoryLoaded = "";
                      }}
                    />
                  </div>
                {/snippet}
              </SearchFilterBar>
            </div>
            {#if memoryRecords.length > 0}
              <div class="agent-profile__memory-list">
                {#each memoryRecords as record (record.type === "candidate" ? record.candidateId : record.memoryId)}
                  <article class="agent-profile__memory-card">
                    <div class="agent-profile__memory-meta">
                      <CommunityChip size="compact" tone="neutral"
                        >{record.kind}</CommunityChip
                      >
                      <CommunityChip
                        size="compact"
                        tone={record.status === "review"
                          ? "warning"
                          : record.status === "active" ||
                              record.status === "approved"
                            ? "success"
                            : "neutral"}>{record.status}</CommunityChip
                      >
                    </div>
                    <p>
                      {record.type === "candidate"
                        ? record.claim
                        : record.content}
                    </p>
                    {#if record.type === "candidate" && record.evidence.length > 0}
                      <details>
                        <summary
                          ><ChevronRightIcon
                            class="agent-profile__evidence-closed"
                            aria-hidden="true"
                          /><ChevronDownIcon
                            class="agent-profile__evidence-open"
                            aria-hidden="true"
                          />Evidence ({record.evidence.length})</summary
                        >
                        <ul>
                          {#each record.evidence as evidence (evidence.eventId)}<li
                            >
                              <span class="agent-profile__key"
                                >{evidence.eventId.slice(0, 12)}…</span
                              >
                            </li>{/each}
                        </ul>
                      </details>
                    {/if}
                    {#if record.type === "candidate" && record.status === "review"}
                      <div
                        class="agent-profile__memory-actions"
                        role="group"
                        aria-label={`Review ${record.kind} memory`}
                      >
                        <Button
                          size="sm"
                          class="agent-profile__memory-action agent-profile__memory-action--approve"
                          disabled={pending || !onActOnMemory}
                          onclick={() =>
                            actOnMemory({
                              action: "approve",
                              candidateId: record.candidateId,
                            })}
                          ><CircleCheckIcon aria-hidden="true" />Approve</Button
                        >
                        <Button
                          size="sm"
                          variant="outline"
                          class="agent-profile__memory-action agent-profile__memory-action--reject"
                          disabled={pending || !onActOnMemory}
                          onclick={() =>
                            actOnMemory({
                              action: "reject",
                              candidateId: record.candidateId,
                            })}><CircleXIcon aria-hidden="true" />Reject</Button
                        >
                      </div>
                    {:else if record.type === "memory" && record.status === "active"}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending || !onActOnMemory}
                        onclick={() =>
                          actOnMemory({
                            action: "retract",
                            memoryId: record.memoryId,
                          })}
                        ><RotateCcwIcon aria-hidden="true" />Retract</Button
                      >
                    {/if}
                  </article>
                {/each}
              </div>
            {:else}<p>
                {pending ? "Loading memories…" : "No memories match this view."}
              </p>{/if}
          {:else}<p>
              Add the agent to a channel before managing memories.
            </p>{/if}
        </div>
      </Tabs.Content>{/if}
  </Tabs.Root>
</article>

<CommunityAgentEditorDialog
  {members}
  {memberResults}
  {onSearchMembers}
  bind:open={personaOpen}
  {agent}
  {personas}
  {runtime}
  {connected}
  {onSaveAgent}
  {onSaveRuntime}
  {onUnlinkPersona}
  {onDeletePersona}
/>

<Dialog.Root bind:open={addOpen}>
  <DialogFrame
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
    size="form"
  >
    {#snippet title()}Add agent to channel{/snippet}
    {#snippet description()}Add {agent.name} to a channel so members can include
      it in the conversation.{/snippet}

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
                          />{:else if room.kind === "channel" && room.isProjectChannel}<CommunityProjectChannelIcon
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

    {#snippet footer()}<Button
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
      >{/snippet}
  </DialogFrame>
</Dialog.Root>
<ConfirmDialog
  open={removeRoom !== undefined}
  onOpenChange={(open) => {
    if (!open) removeRoom = undefined;
  }}
  title={`Remove ${agent.name} from ${removeRoom?.name}?`}
  description="The agent will lose access to this channel. You can add it again later if permitted."
  confirmLabel="Remove agent"
  destructive
  onConfirm={async () => {
    if (!removeRoom) return false;
    await onRemoveChannel(removeRoom.id);
  }}
/>

<style>
  .agent-profile {
    min-width: 0;
    grid-template-columns: minmax(0, 1fr);
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
  header h2 {
    margin: 0;
  }
  :global(.agent-profile__name-edit.agent-profile__name-edit) {
    display: inline-flex;
    width: auto;
    height: auto;
    align-items: center;
    gap: 0.375rem;
    padding: 0.125rem 0.375rem;
    color: inherit;
    font: inherit;
    letter-spacing: inherit;
  }
  :global(.agent-profile__name-edit-icon) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--muted-foreground);
    opacity: 0;
    transform: translateX(-0.125rem);
    transition:
      opacity 0.16s ease,
      transform 0.16s ease;
  }
  header:hover :global(.agent-profile__name-edit-icon),
  :global(.agent-profile__name-edit:hover .agent-profile__name-edit-icon),
  :global(
      .agent-profile__name-edit:focus-visible .agent-profile__name-edit-icon
    ) {
    opacity: 1;
    transform: translateX(0);
  }
  :global(.agent-profile__name-edit-icon svg) {
    width: 0.875rem;
    height: 0.875rem;
  }
  h2,
  h3,
  p {
    margin: 0;
  }
  h2 {
    font-size: var(--community-text-page);
    font-weight: 650;
    text-align: center;
  }
  h3 {
    font-size: var(--community-text-body);
    font-weight: 600;
  }
  p {
    color: var(--muted-foreground);
    line-height: 1.6;
    overflow-wrap: anywhere;
  }
  .agent-profile__signals {
    display: flex;
    gap: 0.625rem;
    justify-content: center;
    flex-wrap: wrap;
  }
  .agent-profile__actions {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    gap: 0.625rem;
  }
  .agent-profile__actions :global(button) {
    min-width: 0;
    width: 100%;
    padding-inline: 0.375rem;
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
    min-width: 0;
    overflow-x: auto;
    justify-content: flex-start;
  }
  :global(.agent-profile__tabs > button) {
    flex: 1 0 auto;
  }
  .agent-profile__info,
  .agent-profile__channels,
  .agent-profile__runtime,
  .agent-profile__memories {
    display: grid;
    gap: 1.25rem;
    padding-top: 1rem;
  }
  .agent-profile__section-heading,
  .agent-profile__section-actions,
  .agent-profile__memory-meta,
  .agent-profile__memory-actions,
  .agent-profile__tool-list {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }
  .agent-profile__section-heading {
    justify-content: space-between;
  }
  .agent-profile__section-actions {
    justify-content: flex-end;
  }
  .agent-profile__section-heading h3,
  .agent-profile__section-heading p,
  .agent-profile__memory-card p {
    margin: 0;
  }
  .agent-profile__section-heading p {
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
  }
  .agent-profile__runtime-summary {
    display: grid;
    gap: 0;
    margin: 0;
    border: 1px solid var(--border);
    border-radius: 1rem;
    overflow: hidden;
  }
  .agent-profile__runtime-summary > div {
    display: grid;
    grid-template-columns: minmax(5rem, 0.7fr) minmax(0, 1.3fr);
    gap: 1rem;
    padding: 0.75rem 1rem;
  }
  .agent-profile__runtime-summary > div + div {
    border-top: 1px solid var(--border);
  }
  .agent-profile__runtime-summary dt {
    color: var(--muted-foreground);
  }
  .agent-profile__runtime-summary dd {
    min-width: 0;
    margin: 0;
    text-align: right;
    overflow-wrap: anywhere;
  }
  .agent-profile__runtime-config-title {
    font-size: var(--community-text-body);
  }
  :global(.agent-profile__runtime-fields) {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
    border: 1px solid var(--border);
    border-radius: 1rem;
    overflow: hidden;
  }
  :global(.agent-profile__runtime-fields > *) {
    min-width: 0;
    padding: 0.75rem 1rem;
  }
  :global(.agent-profile__runtime-fields > * + *) {
    border-top: 1px solid var(--border);
  }
  :global(.agent-profile__runtime-field.agent-profile__runtime-field) {
    justify-content: space-between;
    width: 100%;
    height: auto;
    min-height: 3.25rem;
    border-radius: 0;
    color: inherit;
    text-align: left;
  }
  :global(.agent-profile__runtime-field > span) {
    display: grid;
    min-width: 0;
    gap: 0.125rem;
  }
  :global(.agent-profile__runtime-field > span > span) {
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
    font-weight: 500;
  }
  :global(.agent-profile__runtime-field strong) {
    min-width: 0;
    overflow-wrap: anywhere;
    font-weight: 600;
  }
  :global(.agent-profile__runtime-field svg) {
    width: 1rem;
    height: 1rem;
    color: var(--muted-foreground);
  }
  :global(.agent-profile__tools) {
    display: grid;
    border: 1px solid var(--border);
    border-radius: 1rem;
    overflow: hidden;
  }
  :global(.agent-profile__tools-trigger) {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    border: 0;
    padding: 0.75rem 1rem;
    background: transparent;
    color: inherit;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  :global(.agent-profile__tools-trigger:focus-visible) {
    outline: 2px solid var(--ring);
    outline-offset: 0.25rem;
  }
  :global(.agent-profile__tools-trigger svg) {
    width: 1rem;
    height: 1rem;
    color: var(--muted-foreground);
  }
  :global(.agent-profile__tools-content) {
    border-top: 1px solid var(--border);
    padding: 0.75rem 1rem 1rem;
  }
  .agent-profile__tool-list {
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .agent-profile__memory-search,
  .agent-profile__memory-filter-buttons {
    min-width: 0;
  }
  .agent-profile__memory-filter-summary {
    display: inline-flex;
    min-width: 0;
    align-items: center;
    gap: 0.375rem;
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
  }
  .agent-profile__memory-filter-summary span {
    padding-left: 0.375rem;
    border-left: 1px solid var(--border);
  }
  .agent-profile__memory-filter-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .agent-profile__memory-list {
    display: grid;
    gap: 0.75rem;
  }
  .agent-profile__memory-card {
    display: grid;
    gap: 0.75rem;
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: 1rem;
    background: var(--card);
  }
  .agent-profile__memory-card summary {
    display: inline-flex;
    width: max-content;
    max-width: 100%;
    align-items: center;
    gap: 0.375rem;
    color: var(--muted-foreground);
    cursor: pointer;
  }
  :global(.agent-profile__memory-card summary svg) {
    width: 1rem;
    height: 1rem;
  }
  :global(
      .agent-profile__memory-card details[open] .agent-profile__evidence-closed
    ),
  :global(
      .agent-profile__memory-card
        details:not([open])
        .agent-profile__evidence-open
    ) {
    display: none;
  }
  .agent-profile__memory-card details ul {
    margin-bottom: 0;
  }
  .agent-profile__memory-actions {
    width: max-content;
    max-width: 100%;
    gap: 0;
  }
  :global(.agent-profile__memory-action.agent-profile__memory-action) {
    border-radius: 0;
  }
  :global(
      .agent-profile__memory-action--approve.agent-profile__memory-action--approve
    ) {
    border-top-left-radius: var(--radius-md);
    border-bottom-left-radius: var(--radius-md);
  }
  :global(
      .agent-profile__memory-action--reject.agent-profile__memory-action--reject
    ) {
    margin-left: -1px;
    border-top-right-radius: var(--radius-md);
    border-bottom-right-radius: var(--radius-md);
  }
  :global(.agent-profile__memory-action svg) {
    width: 1rem;
    height: 1rem;
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
    font-size: var(--community-text-body);
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
    font-size: var(--community-text-secondary);
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
    font-size: var(--community-text-secondary);
    line-height: 1.6;
  }
  @media (max-width: 480px) {
    .agent-profile__memory-filter-buttons {
      flex-direction: column;
    }
    :global(.agent-profile__runtime-fields) {
      grid-template-columns: minmax(0, 1fr);
    }
    .agent-profile__key-copy {
      flex-direction: column;
      align-items: flex-start;
    }
    .agent-profile__add-body {
      padding: 1rem;
    }
  }
</style>
