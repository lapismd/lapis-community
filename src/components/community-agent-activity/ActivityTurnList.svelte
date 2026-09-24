<script lang="ts">
  import ActivityExecutionPolicy from "./ActivityExecutionPolicy.svelte";
  import CircleStopIcon from "@lucide/svelte/icons/circle-stop";
  import PlayIcon from "@lucide/svelte/icons/play";
  import { Reasoning } from "@lapismd/design-core/ai/experimental";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Tooltip from "@lapismd/design-core/shadcn/tooltip";
  import {
    activityCancelTarget,
    activityRunLabel,
    activityStreams,
  } from "./activity-run-label.js";
  import { activityPlace } from "./activity-place.js";
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

  function cancelTurn(controllerScope: CommunityAgentControllerScope) {
    if (!onCancelTurn) return;
    const target = activityCancelTarget(controllerScope);
    return onCancelTurn(
      agentPubkey,
      target.scopeKey,
      target.channelId,
      target,
    ).catch(() => {});
  }
</script>

{#if rows.length === 0}<p>No open turns.</p>{:else}
  <Tooltip.Provider delayDuration={0}>
    <ul class="activity-turns">
      {#each rows as controllerScope (`${controllerScope.scopeKey}\0${controllerScope.turnId ?? ""}`)}
        {@const place = activityPlace(controllerScope, rooms)}
        {@const action =
          controllerScope.state === "interrupted" ? "Continue" : "Cancel"}
        <li>
          <div class="activity-turns__row">
            {#if place.href}<a class="activity-turns__place" href={place.href}
                >{place.label}</a
              >{:else}<span class="activity-turns__place">{place.label}</span
              >{/if}
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
                ><Tooltip.Root>
                  <Tooltip.Trigger>
                    {#snippet child({ props })}
                      <Button
                        {...props}
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label={action}
                        {disabled}
                        onclick={() => cancelTurn(controllerScope)}
                      >
                        {#if controllerScope.state === "interrupted"}
                          <PlayIcon aria-hidden="true" />
                        {:else}
                          <CircleStopIcon aria-hidden="true" />
                        {/if}
                      </Button>
                    {/snippet}
                  </Tooltip.Trigger>
                  <Tooltip.Content side="top" sideOffset={6}
                    >{action}</Tooltip.Content
                  >
                </Tooltip.Root></span
              >{/if}
          </div>
          {#if controllerScope.executionPolicy}<ActivityExecutionPolicy
              policy={controllerScope.executionPolicy}
            />{/if}
        </li>
      {/each}
    </ul>
  </Tooltip.Provider>
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
    padding: 0.75rem 1rem;
    display: grid;
    gap: 0.5rem;
  }
  .activity-turns__row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }
  li + li {
    border-top: 1px solid var(--border);
  }
  li:hover {
    background: color-mix(in oklab, var(--muted) 75%, var(--background));
  }
  .activity-turns__place {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    color: var(--foreground);
    text-overflow: ellipsis;
    white-space: nowrap;
    text-decoration: none;
  }
  a.activity-turns__place:hover {
    text-decoration: underline;
  }
  .activity-turns__status {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    min-width: 0;
    margin-inline-start: auto;
  }
  .activity-turns__status :global([data-ui-component="ai-chat-reasoning"]) {
    margin: 0;
    min-width: 0;
  }
  .activity-turns__status :global([data-ai-chat-part="reasoning-status"]) {
    width: auto;
    min-height: 0;
    align-items: center;
    padding: 0;
  }
  .activity-turns__status :global([data-ui-part="reasoning-label"]) {
    flex: none;
    min-width: 0;
    text-align: end;
    white-space: normal;
  }
  .activity-turns__action {
    flex-shrink: 0;
  }
  p {
    margin: 0;
    color: var(--muted-foreground);
  }
</style>
