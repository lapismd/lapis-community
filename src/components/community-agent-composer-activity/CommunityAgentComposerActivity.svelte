<script lang="ts">
  import { onMount } from "svelte";
  import ActivityIcon from "@lucide/svelte/icons/activity";
  import AlertIcon from "@lucide/svelte/icons/circle-alert";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Popover from "@lapismd/design-core/shadcn/popover";
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import { activityContextLabel } from "../../community/agent-activity-context.js";
  import type {
    CommunityAgentActivityContext,
    CommunityAgentsState,
  } from "../../community/agent-contracts.js";
  import type { CommunityRoomModel } from "../community-workspace/model.js";
  import { useAgentComposerActivity } from "./context.js";
  import { composerActivity } from "./model.js";
  let {
    context,
    model,
    rooms,
    onOpen,
  }: {
    context: CommunityAgentActivityContext;
    model?: CommunityAgentsState;
    rooms?: readonly CommunityRoomModel[];
    onOpen?: (agent: string, context: CommunityAgentActivityContext) => void;
  } = $props();
  const owner = useAgentComposerActivity();
  let now = $state(Date.now());
  let open = $state(false);
  onMount(() => {
    const timer = setInterval(() => {
      now = Date.now();
    }, 1_000);
    return () => clearInterval(timer);
  });
  const entries = $derived(
    composerActivity(model ?? owner?.model(), context, now),
  );
  const first = $derived(entries[0]);
  const available = $derived(Boolean(model ?? owner?.model()));
  function select(entry: NonNullable<typeof first>) {
    open = false;
    (onOpen ?? owner?.open)?.(entry.agentPubkey, entry.context);
  }
</script>

{#if available}
  <div
    class="agent-composer-activity"
    data-ui-component="community-agent-composer-activity"
    data-state={first?.state}
    role={first?.state === "failed" ? "alert" : "group"}
    aria-label={first?.state === "failed"
      ? `${first.name} request failed: ${first.preview}`
      : "Agent activity"}
  >
    {#if first}
      {#snippet summary()}
        <CommunityMemberAvatar
          member={{
            id: first.agentPubkey,
            name: first.name,
            handle: first.agentPubkey,
            initials: first.name.slice(0, 2),
            ...(first.avatarUrl ? { avatarUrl: first.avatarUrl } : {}),
          }}
          size="xsmall"
          shape="rounded"
          decorative
        />
        {#if first.severity === "error" || first.severity === "warning"}<AlertIcon
            size={12}
            aria-hidden="true"
          />{:else}<ActivityIcon size={12} aria-hidden="true" />{/if}
        <span
          class="agent-composer-activity__line"
          title={`${first.name}: ${first.preview}`}
          >{first.name}: {first.preview}</span
        >
        {#if entries.length > 1}<CommunityChip size="compact"
            >+{entries.length - 1}</CommunityChip
          >{/if}
      {/snippet}
      {#if entries.length === 1}
        {#if first.canOpen}
          <Button
            variant="ghost"
            size="sm"
            class="agent-composer-activity__button"
            aria-label={`View ${first.name} activity`}
            onclick={() => select(first)}>{@render summary()}</Button
          >
        {:else}<div class="agent-composer-activity__button">
            {@render summary()}
          </div>{/if}
      {:else}
        <Popover.Root bind:open>
          <Popover.Trigger
            class="agent-composer-activity__button"
            aria-label="View working agents"
            >{@render summary()}</Popover.Trigger
          >
          <Popover.Content side="top" align="start">
            <div class="agent-composer-activity__entries">
              {#each entries as entry (entry.key)}
                <Button
                  variant="ghost"
                  class="agent-composer-activity__entry"
                  disabled={!entry.canOpen}
                  onclick={() => select(entry)}
                >
                  <span
                    >{entry.name} · {activityContextLabel(
                      entry.context,
                      rooms ?? owner?.rooms(),
                    )}</span
                  >
                  <span class="agent-composer-activity__line"
                    >{entry.preview}</span
                  >
                </Button>
              {/each}
            </div>
          </Popover.Content>
        </Popover.Root>
      {/if}
      {#if first.state !== "failed"}<span
          class="agent-composer-activity__announcement"
          role="status"
          aria-live="polite"
          >{first.name}: {first.state === "waiting_permission"
            ? "Waiting for your permission"
            : "Working"}</span
        >{/if}
    {/if}
  </div>
{/if}

<style>
  .agent-composer-activity {
    min-height: 2rem;
    display: flex;
    align-items: center;
    min-width: 0;
    padding-inline: 0.25rem;
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
  }
  .agent-composer-activity :global(.agent-composer-activity__button) {
    display: flex;
    gap: 0.375rem;
    align-items: center;
    min-width: 0;
    max-width: 100%;
    padding-inline: 0.25rem;
  }
  .agent-composer-activity[data-state="failed"] {
    min-height: 2.25rem;
    margin-block: 0.25rem;
    border: 1px solid color-mix(in srgb, var(--destructive) 30%, transparent);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--destructive) 8%, var(--background));
    color: color-mix(in srgb, var(--destructive) 78%, var(--foreground));
  }
  .agent-composer-activity__line {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
  .agent-composer-activity__entries {
    display: grid;
    gap: 0.25rem;
  }
  .agent-composer-activity__entries :global(.agent-composer-activity__entry) {
    display: grid;
    justify-content: start;
    text-align: left;
    height: auto;
    min-width: 0;
  }
  .agent-composer-activity__announcement {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>
