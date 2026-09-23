<script lang="ts">
  import CommunitySkeleton from "../community-skeleton/CommunitySkeleton.svelte";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import {
    activityMatches,
    observerScope,
  } from "../../community/agent-activity-context.js";
  import { ConfirmDialog } from "@lapismd/design-core/forms/dialog";
  import TrashIcon from "@lucide/svelte/icons/trash-2";
  import type {
    CommunityAgentActivityItem,
    CommunityAgentsState,
  } from "../../community/agent-contracts.js";
  import type {
    CommunityMemberModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";
  import ActivityPermissionStack from "./ActivityPermissionStack.svelte";
  import ActivityTabs from "./ActivityTabs.svelte";
  import { activityStreams } from "./activity-run-label.js";
  import AgentRuntimeControls from "./AgentRuntimeControls.svelte";
  import type { AgentRuntimeActions } from "./runtime-actions.js";
  import { activityConversationKey } from "./activity-conversation-key.js";
  import { permissionHasExpired } from "../../community/permission-expiry.js";
  import CommunityAgentActivityFeed from "./CommunityAgentActivityFeed.svelte";
  import CommunityAgentActivityHeader from "./CommunityAgentActivityHeader.svelte";
  import { transcriptMarkdownMembers } from "./transcript-markdown-members.js";

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
  const identityMembers = $derived(transcriptMarkdownMembers(members, agents));
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
        !permissionHasExpired(permission, Date.now()) &&
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

<section class="agent-activity" aria-label="Agent activity history">
  <CommunityAgentActivityHeader
    {selected}
    {context}
    {rooms}
    {lastActivity}
    {model}
    {onLatest}
  />
  <p class="agent-activity__notice">
    {model.storageMode === "memory"
      ? "Session-only history: persistent storage is unavailable."
      : "Encrypted history is saved on this device."} Missed controller activity
    is requested when this conversation is visible.
    {#if model.activitySyncGap}
      Some activity predates the controller journal and cannot be recovered.{/if}
  </p>
  {#if selected && permissions.length > 0}
    <ActivityPermissionStack
      agent={selected}
      {permissions}
      {...onRespondPermission ? { onRespondPermission } : {}}
    />
  {/if}
  <ActivityTabs>
    {#snippet turns()}
      {#if selected}
        <AgentRuntimeControls
          agent={selected}
          {scopes}
          {rooms}
          {context}
          {...onCancelTurn ? { onCancelTurn } : {}}
          {...onResetConversation ? { onResetConversation } : {}}
        />
      {:else}<p>No open turns.</p>{/if}
    {/snippet}
    {#snippet activity()}
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
            Updates appear when this agent sends activity to your account.
            Community checks the controller for anything missed while
            disconnected.
          </p>
        </div>{/if}
      {#if selected && (model.activity.length > 0 || scopes.some((scope) => scope.active) || model.hasOlder)}
        <CommunityAgentActivityFeed
          working={scopes.some(
            (scope) => scope.active && activityStreams(scope.state),
          )}
          activity={model.activity}
          agent={selected}
          {context}
          members={identityMembers}
          conversationKey={activityConversationKey(selected.pubkey, context)}
          onLoadLatest={async () => {
            await onLatest();
          }}
          onLoadOlder={async () => {
            await onLoadOlder();
          }}
          hasOlder={model.hasOlder}
          loading={model.activityLoading}
          {...onOpenRequest ? { onOpenRequest } : {}}
        />
      {/if}
      {#if selected && context.kind === "overview"}<footer>
          <Button variant="destructive" onclick={() => (clearing = true)}
            ><TrashIcon aria-hidden="true" />Clear this agent’s saved activity</Button
          >
        </footer>{/if}
    {/snippet}
  </ActivityTabs>
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
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 1rem;
    padding: 1.25rem;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
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
