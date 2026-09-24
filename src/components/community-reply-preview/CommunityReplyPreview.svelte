<script lang="ts">
  import ReplyIcon from "@lucide/svelte/icons/reply";
  import { Button } from "@lapismd/design-core/shadcn/button";
  let {
    target,
    onOpen,
  }: { target: { authorName: string; content: string }; onOpen?: () => void } =
    $props();
</script>

{#snippet preview()}
  <span class="reply-preview">
    <ReplyIcon aria-hidden="true" />
    <strong>Replying to {target.authorName}</strong>
    <small title={target.content}>{target.content}</small>
  </span>
{/snippet}
{#if onOpen}
  <Button
    variant="ghost"
    class="reply-preview__action"
    onclick={onOpen}
    aria-label={`Replying to ${target.authorName}: ${target.content}`}
  >
    {@render preview()}
  </Button>
{:else}{@render preview()}{/if}

<style>
  .reply-preview {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    min-width: 0;
    flex: 1;
    column-gap: 0.35rem;
    row-gap: 0.1rem;
  }

  .reply-preview strong {
    grid-column: 2;
    font-size: var(--community-text-secondary);
    font-weight: 600;
    line-height: 1rem;
  }

  .reply-preview > :global(svg) {
    grid-row: 1 / span 2;
    grid-column: 1;
    width: 0.8rem;
    height: 0.8rem;
    margin-block-start: 0.1rem;
  }

  .reply-preview small {
    display: block;
    grid-column: 2;
    overflow: hidden;
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
    line-height: 1rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.reply-preview__action) {
    max-width: 100%;
    width: 100%;
    height: auto;
    justify-content: flex-start;
    text-align: start;
  }
</style>
