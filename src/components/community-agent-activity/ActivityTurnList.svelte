<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import {
    activityCancelTarget,
    activityControlHeading,
  } from "./activity-run-label.js";
  import type { CommunityAgentControllerScope } from "../../community/agent-contracts.js";
  import type { CommunityRoomModel } from "../community-workspace/model.js";

  let {
    agentPubkey,
    rows,
    rooms,
    disabled,
    onCancelTurn,
  }: {
    agentPubkey: string;
    rows: readonly CommunityAgentControllerScope[];
    rooms: readonly CommunityRoomModel[];
    disabled: boolean;
    onCancelTurn?: (
      pubkey: string,
      scopeKey: string,
      channelId: string | undefined,
      expected: {
        scopeKey: string;
        channelId?: string;
        sessionId: string;
        turnId: string;
      },
    ) => Promise<void>;
  } = $props();
</script>

{#if rows.length === 0}<p>No open turns.</p>{:else}
  <ul class="activity-turns">
    {#each rows as controllerScope (`${controllerScope.scopeKey}\0${controllerScope.turnId ?? ""}`)}
      <li>
        <span>{activityControlHeading(controllerScope, rooms)}</span>
        {#if controllerScope.active && onCancelTurn}<Button
            variant="outline"
            size="sm"
            {disabled}
            onclick={() => {
              const target = activityCancelTarget(controllerScope);
              return onCancelTurn(
                agentPubkey,
                target.scopeKey,
                target.channelId,
                target,
              ).catch(() => {});
            }}
            >{controllerScope.state === "interrupted"
              ? "Continue"
              : "Cancel"}</Button
          >{/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .activity-turns {
    list-style: none;
    width: 100%;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }
  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }
  span {
    min-width: 0;
    color: var(--muted-foreground);
  }
  p {
    margin: 0;
    color: var(--muted-foreground);
  }
</style>
