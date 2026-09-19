<script lang="ts">
  import CommunitySkeleton from "../community-skeleton/CommunitySkeleton.svelte";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import {
    activityMatches,
    observerScope,
    activityContextLabel,
  } from "../../community/agent-activity-context.js";
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import { ConfirmDialog } from "@lapismd/design-core/forms/dialog";
  import RefreshIcon from "@lucide/svelte/icons/refresh-cw";
  import TrashIcon from "@lucide/svelte/icons/trash-2";
  import type {
    CommunityAgentActivityItem,
    CommunityAgentsState,
  } from "../../community/agent-contracts.js";
  import type { CommunityRoomModel } from "../community-workspace/model.js";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunityRelativeTime from "../community-relative-time/CommunityRelativeTime.svelte";
  import AgentRuntimeControls from "./AgentRuntimeControls.svelte";
  import type { AgentRuntimeActions } from "./runtime-actions.js";
  import CommunityAgentTranscript from "./CommunityAgentTranscript.svelte";
  import type { CommunityMemberModel } from "../community-workspace/model.js";

  let {
    model,
    rooms = [],
    members = [],

    onLatest,
    onOpenRequest,
    onLoadOlder,
    onClearHistory,
    onCancelTurn,
    onResetConversation,
    onRespondPermission,
  }: {
    model: CommunityAgentsState;
    rooms?: readonly CommunityRoomModel[];
    members?: readonly CommunityMemberModel[];
    onBack?: () => void;
    onSelectAgent?: (pubkey: string) => void;
    onSelectChannel?: (channel?: string) => void;
    onLatest: () => void | Promise<void>;
    onOpenRequest?: (item: CommunityAgentActivityItem) => void;
    onLoadOlder: () => void | Promise<void>;
    onClearHistory: () => Promise<void>;
  } & AgentRuntimeActions = $props();
  let clearing = $state(false);
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
  const context = $derived(
    model.activityContext ??
      (model.activityChannel
        ? { kind: "channel" as const, channelId: model.activityChannel }
        : { kind: "overview" as const }),
  );
  const scopes = $derived(
    Object.values(model.conversationScopes ?? model.controllerScopes).filter(
      (scope) =>
        scope.agentPubkey === selected?.pubkey &&
        activityMatches(context, scope),
    ),
  );
  const permissions = $derived(
    (selected ? (model.pendingPermissions[selected.pubkey] ?? []) : []).filter(
      (permission) =>
        activityMatches(context, {
          ...permission,
          ...observerScope({
            version: 2,
            kind: "",
            seq: 0,
            timestamp: "",
            payload: { scopeKey: permission.scopeKey },
            ...(permission.channelId
              ? { channelId: permission.channelId }
              : {}),
          }),
        }),
    ),
  );
  const lastActivity = $derived(model.activity[0]);
</script>

{#snippet historyHeader()}
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
{/snippet}

<section class="agent-activity" aria-label="Agent activity history">
  <div class="agent-activity__identity">
    {#if selected}<CommunityMemberAvatar
        member={{
          id: selected.pubkey,
          name: selected.name,
          handle: selected.pubkey,
          initials: selected.name.slice(0, 2),
          ...(selected.avatarUrl ? { avatarUrl: selected.avatarUrl } : {}),
        }}
        size="small"
        shape="rounded"
        decorative
      />{/if}
    <div>
      <h2>{selected?.name ?? "Agent activity"}</h2>
      <p>{activityContextLabel(context, rooms)}</p>
      {#if lastActivity}<small
          >Last updated <CommunityRelativeTime
            timestamp={Date.parse(lastActivity.frame.timestamp) / 1000}
          /></small
        >{/if}
    </div>
  </div>
  <div class="agent-activity__toolbar">
    <CommunityChip
      size="compact"
      tone={model.activitySyncStatus === "caught-up" ||
      (model.status === "ready" && model.capabilities.activity)
        ? "success"
        : "warning"}
      >{model.activitySyncStatus === "checking"
        ? "Checking activity"
        : model.activitySyncStatus === "caught-up"
          ? "Caught up"
          : model.activitySyncStatus === "unavailable"
            ? "Catch-up unavailable"
            : model.status === "ready" && model.capabilities.activity
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
      : "Encrypted history is saved on this device."} Missed controller activity
    is requested when this conversation is visible.
    {#if model.activitySyncGap}
      Some activity predates the controller journal and cannot be recovered.{/if}
  </p>
  {#if selected}
    <AgentRuntimeControls
      agent={selected}
      {scopes}
      {permissions}
      {rooms}
      {...onCancelTurn ? { onCancelTurn } : {}}
      {...onResetConversation ? { onResetConversation } : {}}
      {...onRespondPermission ? { onRespondPermission } : {}}
    />
  {/if}
  {#if model.archiveError}<p role="alert">{model.archiveError}</p>{/if}
  {#if model.activityError}<p role="alert">{model.activityError}</p>{/if}
  {#if model.activityLoading && model.activity.length === 0}<CommunitySkeleton
      layout="timeline"
      label="Loading activity"
    />{/if}
  {#if model.activity.length === 0 && !model.activityLoading && !model.activityError}<div
      class="agent-activity__empty"
    >
      <h3>No saved activity here yet</h3>
      <p>
        Updates appear when this agent sends activity to your account. Community
        checks the controller for anything missed while disconnected.
      </p>
    </div>{/if}
  {#if selected && (model.activity.length > 0 || scopes.some((scope) => scope.active) || model.hasOlder)}
    <CommunityAgentTranscript
      header={historyHeader}
      working={scopes.some((scope) => scope.active)}
      activity={model.activity}
      agent={selected}
      {context}
      {members}
      {...onOpenRequest ? { onOpenRequest } : {}}
    />
  {/if}
  {#if selected && context.kind === "overview"}<footer>
      <Button
        variant="destructive"
        onclick={() => {
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
  .agent-activity__identity {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }
  .agent-activity__identity h2,
  .agent-activity__identity p {
    margin: 0;
  }
  .agent-activity {
    display: grid;
    gap: 1rem;
    padding: 1.25rem;
    min-width: 0;
  }

  .agent-activity__toolbar {
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
  .agent-activity__notice {
    font-size: var(--community-text-secondary);
    color: var(--muted-foreground);
  }
  .agent-activity__empty {
    padding: 2rem 0.5rem;
    text-align: center;
    display: grid;
    gap: 0.75rem;
  }
  footer {
    border-top: 1px solid var(--border);
    padding-top: 1rem;
  }
</style>
