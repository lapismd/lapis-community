<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { ConfirmDialog } from "@lapismd/design-core/forms/dialog";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CircleStopIcon from "@lucide/svelte/icons/circle-stop";
  import RotateIcon from "@lucide/svelte/icons/rotate-ccw";
  import {
    activityContextLabel,
    contextForScope,
  } from "../../community/agent-activity-context.js";
  import type {
    CommunityAgentPermissionDecision,
    CommunityAgentControllerScope,
    CommunityAgentIdentity,
    CommunityAgentsState,
  } from "../../community/agent-contracts.js";
  import type { CommunityRoomModel } from "../community-workspace/model.js";
  import CommunityProfileActions from "../community-profile-actions/CommunityProfileActions.svelte";
  import type { AgentRuntimeActions } from "./runtime-actions.js";
  let {
    agent,
    scopes,
    permissions,
    rooms,
    onCancelTurn,
    onResetConversation,
    onRespondPermission,
  }: AgentRuntimeActions & {
    agent: CommunityAgentIdentity;
    scopes: CommunityAgentControllerScope[];
    permissions: CommunityAgentsState["pendingPermissions"][string];
    rooms: readonly CommunityRoomModel[];
  } = $props();
  let resetting = $state(false);
  let resetTarget = $state<CommunityAgentControllerScope>();
  let controlError = $state("");
  let controlPending = $state("");
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

{#if permissions.length > 0 || scopes.some((scope) => scope.sessionId && (onResetConversation || (scope.active && onCancelTurn)))}
  <section class="agent-activity__controls" aria-label="Agent runtime controls">
    {#each scopes as controllerScope (controllerScope.scopeKey)}
      {#if controllerScope.sessionId && (onResetConversation || (controllerScope.active && onCancelTurn))}
        {#if scopes.length > 1}<p>
            {activityContextLabel(contextForScope(controllerScope), rooms)}
          </p>{/if}
        <CommunityProfileActions
          label={`Actions for ${activityContextLabel(contextForScope(controllerScope), rooms)}`}
        >
          {#if controllerScope.active && controllerScope.sessionId && onCancelTurn}<Button
              variant="secondary"
              disabled={Boolean(controlPending)}
              onclick={() =>
                runControl("cancel", () =>
                  onCancelTurn(
                    agent.pubkey,
                    controllerScope.scopeKey,
                    controllerScope.channelId,
                    {
                      sessionId: controllerScope.sessionId ?? "",
                      turnId: controllerScope.turnId ?? "",
                    },
                  ),
                ).catch(() => {})}
              ><CircleStopIcon aria-hidden="true" />Cancel turn</Button
            >{/if}
          {#if onResetConversation && controllerScope.sessionId}<Button
              variant="secondary"
              disabled={Boolean(controlPending)}
              onclick={() => {
                resetTarget = { ...controllerScope };
                resetting = true;
              }}><RotateIcon aria-hidden="true" />Reset conversation</Button
            >{/if}
        </CommunityProfileActions>
      {/if}
    {/each}
    {#if permissions.length > 0}<CommunityChip size="compact" tone="warning"
        >Waiting for approval</CommunityChip
      >{/if}
    {#each permissions as permission (permission.requestId)}
      <article
        class="agent-activity__permission"
        aria-label={`Permission requested by ${agent.name}`}
      >
        <div>
          <h3>{permission.tool}</h3>
          <p>The agent requested an explicit action.</p>
        </div>
        {#if permissionInput(permission.input)}<pre>{permissionInput(
              permission.input,
            )}</pre>{/if}
        {#if permission.expiresAt}<p class="agent-activity__permission-expiry">
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
                    agent.pubkey,
                    permission.requestId,
                    decision,
                    permission.channelId,
                  ),
                ).catch(() => {})}>{decisionLabels[decision]}</Button
            >
          {/each}
        </div>
      </article>
    {/each}
    {#if controlError}<p role="alert">{controlError}</p>{/if}
  </section>
{/if}
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
  .agent-activity__controls {
    display: grid;
    gap: 0.875rem;
  }
  p {
    margin: 0;
    color: var(--muted-foreground);
  }
  .agent-activity__permission {
    display: grid;
    gap: 0.875rem;
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--card);
  }
  .agent-activity__permission-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.625rem;
    flex-wrap: wrap;
  }
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
</style>
