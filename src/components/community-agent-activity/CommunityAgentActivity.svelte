<script lang="ts">
  import CommunitySkeleton from "../community-skeleton/CommunitySkeleton.svelte";
  import CommunityMarkdownContent from "../community-markdown-content/CommunityMarkdownContent.svelte";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Select from "@lapismd/design-core/shadcn/select";
  import { ConfirmDialog } from "@lapismd/design-core/forms/dialog";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import RefreshIcon from "@lucide/svelte/icons/refresh-cw";
  import XIcon from "@lucide/svelte/icons/x";
  import MessageIcon from "@lucide/svelte/icons/message-square";
  import WrenchIcon from "@lucide/svelte/icons/wrench";
  import PlanIcon from "@lucide/svelte/icons/list-checks";
  import ActivityIcon from "@lucide/svelte/icons/activity";
  import AlertIcon from "@lucide/svelte/icons/circle-alert";
  import EventIcon from "@lucide/svelte/icons/circle-dot";
  import TrashIcon from "@lucide/svelte/icons/trash-2";
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
  const activityIcons = {
    Message: MessageIcon,
    Tool: WrenchIcon,
    Plan: PlanIcon,
    Status: ActivityIcon,
    Error: AlertIcon,
    Event: EventIcon,
  };
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
  {#if model.activityLoading && model.activity.length === 0}<CommunitySkeleton
      layout="timeline"
      label="Loading activity"
    />{/if}
  {#if model.activity.length === 0 && !model.activityLoading}<div
      class="agent-activity__empty"
    >
      <h3>No saved activity here yet</h3>
      <p>
        Updates appear when this agent sends activity to your account. Community
        cannot retrieve events it missed while disconnected.
      </p>
    </div>{/if}
  <ol class="agent-activity__timeline" aria-label="Agent event timeline">
    {#each model.activity as item (item.id)}
      {@const entry = presentAgentActivity(item)}
      {@const Marker = activityIcons[entry.category]}
      <li data-turn-id={item.frame.turnId ?? undefined}>
        <span
          class="agent-activity__marker"
          data-category={entry.category}
          role="img"
          aria-label={`${entry.category} activity`}
        >
          <Marker aria-hidden="true" />
        </span>
        <div class="agent-activity__content">
          <div class="agent-activity__meta">
            <h3>{entry.title}</h3>
            <span class="agent-activity__time"
              ><CommunityRelativeTime
                timestamp={Date.parse(item.frame.timestamp) / 1_000}
              /></span
            >
          </div>
          {#if entry.body}{#if entry.category === "Tool" || entry.category === "Event"}<pre>{entry.body}</pre>{:else}<CommunityMarkdownContent
                content={entry.body}
              />{/if}{/if}
        </div>
      </li>
    {/each}
  </ol>
  {#if model.activityLoading && model.activity.length > 0}<CommunitySkeleton
      layout="timeline"
      count={2}
      label="Loading older activity"
    />{/if}
  {#if model.hasOlder}<Button
      variant="outline"
      disabled={model.activityLoading}
      onclick={() => void onLoadOlder()}>Load older activity</Button
    >{/if}
  {#if selected}<footer>
      <Button
        variant="destructive"
        onclick={() => {
          error = "";
          clearing = true;
        }}
        ><TrashIcon aria-hidden="true" />Clear this agent’s saved activity</Button
      >
    </footer>{/if}
</section>

<ConfirmDialog
  bind:open={clearing}
  title={`Clear ${selected?.name}’s saved activity?`}
  description="This removes this agent’s local history for this community. The relay cannot restore it."
  confirmLabel="Clear history"
  destructive
  onConfirm={onClearHistory}
/>

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
    font-size: var(--community-text-secondary);
    color: var(--muted-foreground);
  }
  .agent-activity__empty {
    padding: 2rem 0.5rem;
    text-align: center;
    display: grid;
    gap: 0.75rem;
  }
  h3 {
    font-size: var(--community-text-body);
    font-weight: 600;
    margin: 0;
  }
  .agent-activity__timeline {
    position: relative;
    display: grid;
    gap: 0.35rem;
    padding: 0.25rem 0 0.75rem;
    margin: 0;
    list-style: none;
  }
  .agent-activity__timeline::before {
    position: absolute;
    inset-block: 1.15rem 1.25rem;
    inset-inline-start: 0.95rem;
    width: 1px;
    background: var(--border);
    content: "";
  }
  .agent-activity__timeline:empty::before {
    content: none;
  }
  .agent-activity__timeline > li {
    position: relative;
    display: grid;
    grid-template-columns: 2rem minmax(0, 1fr);
    align-items: start;
    gap: 0.65rem;
    min-width: 0;
  }
  .agent-activity__marker {
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    box-sizing: border-box;
    border: 1px solid var(--border);
    border-radius: 50%;
    background: var(--background);
    color: var(--muted-foreground);
  }
  .agent-activity__marker :global(svg) {
    width: 0.9rem;
    height: 0.9rem;
  }
  .agent-activity__marker[data-category="Error"] {
    color: var(--destructive);
  }
  .agent-activity__content {
    display: grid;
    justify-items: start;
    gap: 0.625rem;
    padding-block: 0.4rem 1rem;
    min-width: 0;
  }
  .agent-activity__meta {
    width: 100%;
    align-items: baseline;
  }
  pre {
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font: inherit;
    font-size: var(--community-text-body);
    line-height: 1.6;
    max-height: 24rem;
    overflow: auto;
  }
  footer {
    border-top: 1px solid var(--border);
    padding-top: 1rem;
  }
</style>
