<script lang="ts">
  import { ConfirmDialog } from "@lapismd/design-core/forms/dialog";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import ActivityRunDisclosure from "./ActivityRunDisclosure.svelte";
  import {
    activityCancelTarget,
    activityControlRows,
    activityShowsReset,
  } from "./activity-run-label.js";
  import type {
    CommunityAgentActivityContext,
    CommunityAgentControllerScope,
    CommunityAgentIdentity,
    CommunityAgentsState,
  } from "../../community/agent-contracts.js";
  import type { CommunityRoomModel } from "../community-workspace/model.js";
  import AgentPermissionCard from "./AgentPermissionCard.svelte";
  import type { AgentRuntimeActions } from "./runtime-actions.js";
  let {
    agent,
    context,
    scopes,
    permissions,
    rooms,
    onCancelTurn,
    onResetConversation,
    onRespondPermission,
  }: AgentRuntimeActions & {
    agent: CommunityAgentIdentity;
    context?: CommunityAgentActivityContext;
    scopes: CommunityAgentControllerScope[];
    permissions: CommunityAgentsState["pendingPermissions"][string];
    rooms: readonly CommunityRoomModel[];
  } = $props();
  let resetting = $state(false);
  let resetTarget = $state<CommunityAgentControllerScope>();
  let controlError = $state("");
  let controlPending = $state("");
  const rows = $derived(activityControlRows(scopes));

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

{#if permissions.length > 0 || rows.length > 0}
  <section class="agent-activity__controls" aria-label="Agent runtime controls">
    {#each rows as controllerScope (`${controllerScope.scopeKey}\0${controllerScope.turnId ?? ""}`)}
      <ActivityRunDisclosure
        scope={controllerScope}
        {rooms}
        showReset={Boolean(
          onResetConversation &&
            activityShowsReset(controllerScope, scopes, context),
        )}
        disabled={Boolean(controlPending)}
        {...onCancelTurn
          ? {
              onCancel: () =>
                runControl("cancel", () => {
                  const target = activityCancelTarget(controllerScope);
                  return onCancelTurn(
                    agent.pubkey,
                    target.scopeKey,
                    target.channelId,
                    target,
                  );
                }),
            }
          : {}}
        {...onResetConversation
          ? {
              onReset: () => {
                resetTarget = { ...controllerScope };
                resetting = true;
              },
            }
          : {}}
      />
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
