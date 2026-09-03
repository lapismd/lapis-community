<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Tooltip from "@lapismd/design-core/shadcn/tooltip";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";

  let {
    total = 0,
    displayedStart = 0,
    displayedEnd = 0,
    loading = false,
    onRefresh,
  }: {
    total?: number;
    displayedStart?: number;
    displayedEnd?: number;
    loading?: boolean;
    onRefresh: () => void | Promise<void>;
  } = $props();
</script>

<div class="comments-heading">
  <div>
    <h3>Discussion</h3>
    <p>
      {#if total === 0}
        Follow the conversation in posting order.
      {:else}
        Loaded posts {displayedStart}–{displayedEnd} of {total}.
      {/if}
    </p>
  </div>
  <Tooltip.Provider>
    <Tooltip.Root>
      <Tooltip.Trigger>
        {#snippet child({ props })}
          <Button
            {...props}
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={loading}
            aria-label="Refresh discussion"
            onclick={onRefresh}
          >
            <RefreshCwIcon aria-hidden="true" />
          </Button>
        {/snippet}
      </Tooltip.Trigger>
      <Tooltip.Content><p>Refresh discussion</p></Tooltip.Content>
    </Tooltip.Root>
  </Tooltip.Provider>
</div>

<style>
  .comments-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  h3 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 650;
  }

  p {
    margin: 0;
    color: var(--muted-foreground);
    font-size: 0.78rem;
  }

  @media (max-width: 44rem) {
    .comments-heading {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>
