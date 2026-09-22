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
    CommunityAgentControllerScope,
    CommunityAgentIdentity,
    CommunityAgentsState,
  } from "../../community/agent-contracts.js";
  import type { CommunityRoomModel } from "../community-workspace/model.js";
  import CommunityProfileActions from "../community-profile-actions/CommunityProfileActions.svelte";
  import AgentPermissionCard from "./AgentPermissionCard.svelte";
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
      <AgentPermissionCard
        agentName={agent.name}
        {permission}
        disabled={Boolean(controlPending) || !onRespondPermission}
        onDecide={(decision) =>
          onRespondPermission &&
          runControl(permission.requestId, () =>
            onRespondPermission(
              agent.pubkey,
              permission.requestId,
              decision,
              permission.channelId,
            ),
          ).catch(() => {})}
      />
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
</style>
