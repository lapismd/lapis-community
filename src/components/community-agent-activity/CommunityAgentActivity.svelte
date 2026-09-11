<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Select from "@lapismd/design-core/shadcn/select";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import RefreshIcon from "@lucide/svelte/icons/refresh-cw";
  import XIcon from "@lucide/svelte/icons/x";
  import type { CommunityAgentsState } from "../../community/agent-contracts.js";
  import type { CommunityRoomModel } from "../community-workspace/model.js";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunityRelativeTime from "../community-relative-time/CommunityRelativeTime.svelte";
  import { presentAgentActivity } from "./model.js";

  let {
    model,
    rooms = [],
    onBack,
    onSelectAgent,
    onSelectChannel,
    onLatest,
    onLoadOlder,
    onClearHistory,
  }: {
    model: CommunityAgentsState;
    rooms?: readonly CommunityRoomModel[];
    onBack: () => void;
    onSelectAgent: (pubkey: string) => void;
    onSelectChannel: (channel?: string) => void;
    onLatest: () => void | Promise<void>;
    onLoadOlder: () => void | Promise<void>;
    onClearHistory: () => Promise<void>;
  } = $props();
  let clearing = $state(false);
  let pending = $state(false);
  let error = $state("");
  const agents = $derived([
    ...new Map(
      [...model.archivedAgents, ...model.agents].map((agent) => [
        agent.pubkey,
        agent,
      ]),
    ).values(),
  ]);
  const selected = $derived(
    agents.find((agent) => agent.pubkey === model.activityAgent),
  );
  const channels = $derived(rooms.filter((room) => room.kind !== "direct"));
  async function clear() {
    pending = true;
    error = "";
    try {
      await onClearHistory();
      clearing = false;
    } catch (cause) {
      error =
        cause instanceof Error
          ? cause.message
          : "History could not be cleared.";
    } finally {
      pending = false;
    }
  }
</script>

<section class="agent-activity" aria-label="Agent activity history">
  <Button variant="ghost" class="agent-activity__back" onclick={onBack}
    ><ArrowLeftIcon aria-hidden="true" />{model.agents.some(
      (agent) => agent.pubkey === model.activityAgent,
    )
      ? "Back to profile"
      : "Back to agents"}</Button
  >
  <div class="agent-activity__filters">
    <Select.Root
      type="single"
      value={model.activityAgent ?? ""}
      onValueChange={onSelectAgent}
      ><Select.Trigger aria-label="Activity agent"
        >{selected?.name ?? "Choose an agent"}</Select.Trigger
      ><Select.Content aria-label="Activity agent"
        >{#each agents as agent (agent.pubkey)}<Select.Item
            value={agent.pubkey}
            label={agent.name}
            >{agent.name}{model.agents.some(
              (entry) => entry.pubkey === agent.pubkey,
            )
              ? ""
              : " (saved history)"}</Select.Item
          >{/each}</Select.Content
      ></Select.Root
    >
    <Select.Root
      type="single"
      value={model.activityChannel ?? "all"}
      onValueChange={(value) =>
        onSelectChannel(value === "all" ? undefined : value)}
      ><Select.Trigger aria-label="Activity channel"
        >{channels.find(
          (room) => (room.groupId ?? room.id) === model.activityChannel,
        )?.name ?? "All channels"}</Select.Trigger
      ><Select.Content aria-label="Activity channel"
        ><Select.Item value="all">All channels</Select.Item
        >{#each channels as room (room.id)}<Select.Item
            value={room.groupId ?? room.id}
            label={room.name}># {room.name}</Select.Item
          >{/each}</Select.Content
      ></Select.Root
    >
  </div>
  <div class="agent-activity__toolbar">
    <CommunityChip
      size="compact"
      tone={model.status === "ready" && model.capabilities.activity
        ? "success"
        : "warning"}
      >{model.status === "ready" && model.capabilities.activity
        ? "Live capture"
        : "Saved history"}</CommunityChip
    ><Button
      variant="ghost"
      size="sm"
      onclick={() => void onLatest()}
      disabled={model.activityLoading}
      ><RefreshIcon aria-hidden="true" />Latest</Button
    >
  </div>
  <p class="agent-activity__notice">
    {model.storageMode === "memory"
      ? "Session-only history: persistent storage is unavailable."
      : "Encrypted history is saved on this device."} Only activity received while
    signed in is available.
  </p>
  {#if model.archiveError}<p role="alert">{model.archiveError}</p>{/if}
  {#if model.activityError}<p role="alert">{model.activityError}</p>{/if}
  {#if model.activityLoading}<p role="status">Loading activity…</p>{/if}
  {#if model.activity.length === 0 && !model.activityLoading}<div
      class="agent-activity__empty"
    >
      <h3>No saved activity here yet</h3>
      <p>
        Updates appear when this agent sends activity to your account. Community
        cannot retrieve events it missed while disconnected.
      </p>
    </div>{/if}
  <ol class="agent-activity__timeline">
    {#each model.activity as item (item.id)}
      {@const entry = presentAgentActivity(item)}
      <li data-turn-id={item.frame.turnId ?? undefined}>
        <div class="agent-activity__meta">
          <CommunityChip
            size="compact"
            tone={entry.category === "Error" ? "danger" : "neutral"}
            >{entry.category}</CommunityChip
          ><span class="agent-activity__time"
            ><CommunityRelativeTime
              timestamp={Date.parse(item.frame.timestamp) / 1_000}
            /></span
          >
        </div>
        <h3>{entry.title}</h3>
        {#if entry.body}<pre>{entry.body}</pre>{/if}
      </li>
    {/each}
  </ol>
  {#if model.hasOlder}<Button
      variant="outline"
      disabled={model.activityLoading}
      onclick={() => void onLoadOlder()}>Load older activity</Button
    >{/if}
  {#if selected}<footer>
      <Button
        variant="ghost"
        onclick={() => {
          error = "";
          clearing = true;
        }}>Clear this agent’s saved activity</Button
      >
    </footer>{/if}
</section>

<Dialog.Root bind:open={clearing}
  ><Dialog.Content showCloseButton={false}
    ><Dialog.Header
      ><Dialog.Title>Clear {selected?.name}’s saved activity?</Dialog.Title
      ><Dialog.Description
        >This removes this agent’s local history for this community. The relay
        cannot restore it.</Dialog.Description
      ></Dialog.Header
    ><Button
      class="agent-activity__close"
      variant="ghost"
      size="icon-sm"
      aria-label="Close clear agent history dialog"
      onclick={() => (clearing = false)}
      ><XIcon class="size-3.5" aria-hidden="true" /></Button
    >{#if error}<p role="alert">{error}</p>{/if}<Dialog.Footer
      ><Button
        variant="outline"
        disabled={pending}
        onclick={() => (clearing = false)}>Cancel</Button
      ><Button variant="destructive" disabled={pending} onclick={clear}
        >{pending ? "Clearing…" : "Clear history"}</Button
      ></Dialog.Footer
    ></Dialog.Content
  ></Dialog.Root
>

<style>
  .agent-activity {
    display: grid;
    gap: 1rem;
    padding: 1.25rem;
    min-width: 0;
  }
  :global(.agent-activity__back) {
    justify-self: start;
  }
  .agent-activity__filters {
    display: grid;
    gap: 0.625rem;
  }
  .agent-activity__toolbar,
  .agent-activity__meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  p {
    margin: 0;
    color: var(--muted-foreground);
    line-height: 1.5;
  }
  .agent-activity__notice,
  .agent-activity__time {
    font-size: 0.8rem;
    color: var(--muted-foreground);
  }
  .agent-activity__empty {
    padding: 2rem 0.5rem;
    text-align: center;
    display: grid;
    gap: 0.75rem;
  }
  h3 {
    font-size: 0.9rem;
    font-weight: 600;
    margin: 0;
  }
  .agent-activity__timeline {
    display: grid;
    gap: 1.25rem;
    padding: 0;
    margin: 0;
    list-style: none;
  }
  li {
    display: grid;
    gap: 0.625rem;
    border-bottom: 1px solid var(--border);
    padding-bottom: 1.25rem;
    min-width: 0;
  }
  pre {
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font: inherit;
    font-size: 0.85rem;
    line-height: 1.6;
    max-height: 24rem;
    overflow: auto;
  }
  footer {
    border-top: 1px solid var(--border);
    padding-top: 1rem;
  }
  :global(.agent-activity__close) {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    border-radius: 0.5rem;
  }
</style>
