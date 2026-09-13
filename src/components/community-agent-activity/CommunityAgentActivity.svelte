<script lang="ts">
  import CommunitySkeleton from "../community-skeleton/CommunitySkeleton.svelte";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import {
    activityMatches,
    observerScope,
    activityContextLabel,
    contextForScope,
  } from "../../community/agent-activity-context.js";
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import { ConfirmDialog } from "@lapismd/design-core/forms/dialog";
  import RefreshIcon from "@lucide/svelte/icons/refresh-cw";
  import XIcon from "@lucide/svelte/icons/x";
  import TrashIcon from "@lucide/svelte/icons/trash-2";
  import CircleStopIcon from "@lucide/svelte/icons/circle-stop";
  import RotateIcon from "@lucide/svelte/icons/rotate-ccw";
  import ShieldIcon from "@lucide/svelte/icons/shield-check";
  import type {
    CommunityAgentPermissionDecision,
    CommunityAgentActivityItem,
    CommunityAgentControllerScope,
    CommunityAgentsState,
  } from "../../community/agent-contracts.js";
  import type { CommunityRoomModel } from "../community-workspace/model.js";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunityRelativeTime from "../community-relative-time/CommunityRelativeTime.svelte";
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
    onCancelTurn?: (
      pubkey: string,
      scopeKey: string,
      channelId?: string,
      expected?: { sessionId: string; turnId: string },
    ) => Promise<void>;
    onResetConversation?: (
      pubkey: string,
      scopeKey: string,
      channelId?: string,
      expected?: { sessionId: string; turnId: string },
    ) => Promise<void>;
    onRespondPermission?: (
      pubkey: string,
      requestId: string,
      decision: CommunityAgentPermissionDecision,
      channelId?: string,
    ) => Promise<void>;
  } = $props();
  let clearing = $state(false);
  let resetting = $state(false);
  let resetTarget = $state<CommunityAgentControllerScope>();
  let error = $state("");
  let controlError = $state("");
  let controlPending = $state("");
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
  const decisionLabels: Record<CommunityAgentPermissionDecision, string> = {
    allow_once: "Allow once",
    allow_always: "Always allow",
    reject_once: "Deny once",
    reject_always: "Always deny",
    cancel: "Cancel request",
  };

  async function runControl(key: string, operation: () => Promise<void>) {
    if (controlPending) return;
    controlError = "";
    controlPending = key;
    try {
      await operation();
    } catch (cause) {
      controlError =
        cause instanceof Error ? cause.message : "Agent control failed";
      throw cause;
    } finally {
      controlPending = "";
    }
  }

  function permissionInput(value: unknown): string {
    if (value === undefined) return "";
    try {
      return (JSON.stringify(value, null, 2) ?? "").slice(0, 4_000);
    } catch {
      return "Input unavailable";
    }
  }

  function permissionExpiry(value: number): string {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(value);
  }
</script>

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
  {#if selected && (scopes.length > 0 || permissions.length > 0)}
    <section
      class="agent-activity__controls"
      aria-label="Agent runtime controls"
    >
      <div class="agent-activity__controls-heading">
        <div>
          <h3>Runtime controls</h3>
          <p>Owner-only commands are encrypted to this agent.</p>
        </div>
        {#if permissions.length > 0}<CommunityChip size="compact" tone="warning"
            ><ShieldIcon aria-hidden="true" />Waiting for approval</CommunityChip
          >{/if}
      </div>
      {#each scopes as controllerScope (controllerScope.scopeKey)}
        {#if onCancelTurn || onResetConversation}
          <p>{activityContextLabel(contextForScope(controllerScope), rooms)}</p>
          <div class="agent-activity__run-actions">
            {#if controllerScope.active && controllerScope.sessionId && onCancelTurn}<Button
                variant="outline"
                size="sm"
                disabled={Boolean(controlPending)}
                onclick={() =>
                  runControl("cancel", () =>
                    onCancelTurn(
                      selected.pubkey,
                      controllerScope.scopeKey,
                      controllerScope.channelId,
                      {
                        sessionId: controllerScope.sessionId ?? "",
                        turnId: controllerScope.turnId ?? "",
                      },
                    ),
                  )}><CircleStopIcon aria-hidden="true" />Cancel turn</Button
              >{/if}
            {#if onResetConversation && controllerScope.sessionId}<Button
                variant="outline"
                disabled={Boolean(controlPending)}
                onclick={() => {
                  resetTarget = { ...controllerScope };
                  resetting = true;
                }}><RotateIcon aria-hidden="true" />Reset conversation</Button
              >{/if}
          </div>
        {/if}
      {/each}
      {#each permissions as permission (permission.requestId)}
        <article
          class="agent-activity__permission"
          aria-label={`Permission requested by ${selected.name}`}
        >
          <div>
            <h3>{permission.tool}</h3>
            <p>The agent requested an explicit action.</p>
          </div>
          {#if permissionInput(permission.input)}<pre>{permissionInput(
                permission.input,
              )}</pre>{/if}
          {#if permission.expiresAt}<p
              class="agent-activity__permission-expiry"
            >
              Expires <time
                datetime={new Date(permission.expiresAt).toISOString()}
                title={permissionExpiry(permission.expiresAt)}
                >{permissionExpiry(permission.expiresAt)}</time
              >
            </p>{/if}
          <div class="agent-activity__permission-actions">
            {#each permission.options as decision}
              <Button
                variant={decision.startsWith("allow") ? "default" : "outline"}
                size="sm"
                disabled={Boolean(controlPending) || !onRespondPermission}
                onclick={() =>
                  onRespondPermission &&
                  runControl(permission.requestId, () =>
                    onRespondPermission(
                      selected.pubkey,
                      permission.requestId,
                      decision,
                      permission.channelId,
                    ),
                  )}>{decisionLabels[decision]}</Button
              >
            {/each}
          </div>
        </article>
      {/each}
      {#if controlError}<p role="alert">{controlError}</p>{/if}
    </section>
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
  {#if selected && model.activity.length > 0}
    <CommunityAgentTranscript
      activity={model.activity}
      agent={selected}
      {context}
      {members}
      {...onOpenRequest ? { onOpenRequest } : {}}
    />
  {/if}
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
  {#if selected && context.kind === "overview"}<footer>
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

<ConfirmDialog
  bind:open={resetting}
  title="Reset this conversation?"
  description="The next message starts a fresh agent session. Nostr history remains available."
  confirmLabel="Reset conversation"
  onConfirm={async () => {
    const target = resetTarget;
    if (!target || !onResetConversation) return;
    await runControl("reset", () =>
      onResetConversation!(
        target.agentPubkey,
        target.scopeKey,
        target.channelId,
        {
          sessionId: target.sessionId ?? "",
          turnId: target.active ? (target.turnId ?? "") : "",
        },
      ),
    );
  }}
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
  .agent-activity__controls,
  .agent-activity__permission {
    display: grid;
    gap: 0.875rem;
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--card);
  }
  .agent-activity__controls-heading,
  .agent-activity__run-actions,
  .agent-activity__permission-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.625rem;
    flex-wrap: wrap;
  }
  .agent-activity__controls-heading > div,
  .agent-activity__permission > div:first-child {
    display: grid;
    gap: 0.25rem;
  }
  .agent-activity__permission {
    background: var(--background);
  }
  h3 {
    font-size: var(--community-text-body);
    font-weight: 600;
    margin: 0;
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
