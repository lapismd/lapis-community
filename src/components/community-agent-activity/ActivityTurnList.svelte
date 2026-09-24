<script lang="ts">
  import { Reasoning } from "@lapismd/design-core/ai/experimental";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import {
    activityContextLabel,
    contextForScope,
  } from "../../community/agent-activity-context.js";
  import {
    activityCancelTarget,
    activityRunLabel,
    activityStreams,
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
        <span class="activity-turns__place"
          >{activityContextLabel(contextForScope(controllerScope), rooms)}</span
        >
        <span class="activity-turns__status">
          <Reasoning
            label={activityRunLabel(
              controllerScope.state,
              controllerScope.preview,
            )}
            streaming={activityStreams(controllerScope.state)}
          />
        </span>
        {#if controllerScope.active && onCancelTurn}<span
            class="activity-turns__action"
            ><Button
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
          ></span>{/if}
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
    border: 1px solid var(--border);
    border-radius: 1rem;
    overflow: hidden;
  }
  li {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
    padding: 0.75rem 1rem;
  }
  li + li {
    border-top: 1px solid var(--border);
  }
  li:hover {
    background: color-mix(in oklab, var(--muted) 75%, var(--background));
  }
  .activity-turns__place {
    min-width: 0;
    color: var(--muted-foreground);
  }
  .activity-turns__status {
    flex: 1;
    min-width: 0;
  }
  .activity-turns__status :global([data-ui-component="ai-chat-reasoning"]) {
    min-width: 0;
  }
  .activity-turns__status :global([data-ui-part="reasoning-label"]) {
    flex: 1;
    min-width: 0;
    white-space: normal;
  }
  .activity-turns__action {
    margin-inline-start: auto;
    flex-shrink: 0;
  }
  p {
    margin: 0;
    color: var(--muted-foreground);
  }
</style>
