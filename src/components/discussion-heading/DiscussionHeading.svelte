<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";

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
        Loaded posts {displayedStart}–{displayedEnd} of {total}. Scroll for
        adjacent posts or use the timeline to jump.
      {/if}
    </p>
  </div>
  <Button variant="ghost" size="sm" disabled={loading} onclick={onRefresh}>
    Refresh
  </Button>
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
