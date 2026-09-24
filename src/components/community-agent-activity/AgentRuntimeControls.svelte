<script lang="ts">
  import { turnControlFailure } from "../../community/agent-turn-controls.js";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { ConfirmDialog } from "@lapismd/design-core/forms/dialog";
  import ActivityTurnList from "./ActivityTurnList.svelte";
  import {
    activityControlRows,
    activityShowsReset,
  } from "./activity-run-label.js";
  import type {
    CommunityAgentActivityContext,
    CommunityAgentControllerScope,
    CommunityAgentIdentity,
  } from "../../community/agent-contracts.js";
  import type { CommunityRoomModel } from "../community-workspace/model.js";
  import type { AgentRuntimeActions } from "./runtime-actions.js";
  let {
    agent,
    context,
    scopes,
    rooms,
    onContinueTurn,
    turnControls = {},
    onCancelTurn,
    onResetConversation,
  }: AgentRuntimeActions & {
    turnControls?: Readonly<
      Record<
        string,
        import("../../community/agent-turn-control-contracts.js").AgentTurnControlState
      >
    >;
    agent: CommunityAgentIdentity;
    context?: CommunityAgentActivityContext;
    scopes: CommunityAgentControllerScope[];
    rooms: readonly CommunityRoomModel[];
  } = $props();
  let resetting = $state(false);
  let resetTarget = $state<CommunityAgentControllerScope>();
  let controlError = $state("");
  let controlPending = $state("");
  let controlNotice = $state("");
  const visibleControls = $derived(
    Object.values(turnControls).filter(
      (control) =>
        control.agentPubkey === agent.pubkey &&
        scopes.some(
          (scope) =>
            scope.scopeKey === control.scopeKey &&
            scope.requestId === control.requestId,
        ),
    ),
  );
  const pending = $derived(
    Boolean(controlPending) ||
      visibleControls.some((control) => control.status === "pending"),
  );
  const reportedError = $derived(
    controlError ||
      visibleControls.map(turnControlFailure).filter(Boolean).join(" "),
  );
  const reportedStatus = $derived(
    controlPending === "continue" ||
      visibleControls.some((control) => control.status === "pending")
      ? "Waiting for the controller to acknowledge Continue"
      : visibleControls.some((control) => control.status === "acknowledged")
        ? "Continue acknowledged"
        : controlNotice,
  );

  const rows = $derived(activityControlRows(scopes));
  const resetRow = $derived(
    rows.find((row) => activityShowsReset(row, scopes, context)),
  );

  async function runControl(key: string, operation: () => Promise<void>) {
    if (controlPending) return;
    controlError = "";
    controlNotice = "";
    controlPending = key;
    try {
      await operation();
      if (key === "continue") controlNotice = "Continue acknowledged";
    } catch (cause) {
      controlError =
        cause instanceof Error ? cause.message : "Agent control failed";
      throw cause;
    } finally {
      controlPending = "";
    }
  }
</script>

<section class="agent-activity__controls" aria-label="Agent runtime controls">
  <ActivityTurnList
    agentPubkey={agent.pubkey}
    {rows}
    {rooms}
    disabled={pending}
    {turnControls}
    {...onContinueTurn
      ? {
          onContinueTurn: (pubkey, scopeKey, target) =>
            runControl("continue", () =>
              onContinueTurn(pubkey, scopeKey, target),
            ),
        }
      : {}}
    {...onCancelTurn
      ? {
          onCancelTurn: (pubkey, scopeKey, channelId, expected) =>
            runControl("cancel", () =>
              onCancelTurn(pubkey, scopeKey, channelId, expected),
            ),
        }
      : {}}
  />
  {#if onResetConversation && resetRow}<Button
      class="agent-activity__reset"
      variant="outline"
      size="sm"
      disabled={pending}
      onclick={() => {
        resetTarget = { ...resetRow };
        resetting = true;
      }}>Reset conversation</Button
    >{/if}
  {#if reportedError}<p role="alert">
      {reportedError}
    </p>{:else if reportedStatus}<p
      role="status"
      aria-label="Agent control status"
    >
      {reportedStatus}
    </p>{/if}
</section>
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
    width: 100%;
    gap: 0.875rem;
  }
  :global(.agent-activity__reset) {
    justify-self: start;
  }
  p {
    margin: 0;
    color: var(--muted-foreground);
  }
</style>
