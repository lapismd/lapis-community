<script lang="ts">
  import { ComposerDrawer } from "@lapismd/design-core/ai/chat";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import ReplyIcon from "@lucide/svelte/icons/reply";
  import XIcon from "@lucide/svelte/icons/x";

  import type { CommunityReplyTarget } from "../../community/index.js";

  let {
    target,
    onCancel,
  }: {
    target: CommunityReplyTarget;
    onCancel?: () => void;
  } = $props();
</script>

<ComposerDrawer
  class="community-reply-context__drawer"
  role="group"
  aria-label={`Replying to ${target.authorName}`}
>
  <div class="community-reply-context">
    <span>
      <ReplyIcon aria-hidden="true" />
      <strong>Replying to {target.authorName}</strong>
      <small title={target.content}>{target.content}</small>
    </span>
    {#if onCancel}
      <Button
        class="community-reply-context__close"
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Cancel reply"
        onclick={onCancel}
      >
        <XIcon aria-hidden="true" />
      </Button>
    {/if}
  </div>
</ComposerDrawer>

<style>
  :global(
      .community-reply-context__drawer[data-ui-component="ai-chat-composer-drawer"]
    ) {
    padding-block-start: 0.625rem;
    border-radius: 0.75rem 0.75rem 0 0;
    background: color-mix(in srgb, var(--foreground) 4%, var(--background));
  }

  .community-reply-context {
    display: flex;
    width: 100%;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .community-reply-context > span {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    min-width: 0;
    flex: 1;
    column-gap: 0.35rem;
    row-gap: 0.1rem;
  }

  .community-reply-context strong {
    grid-column: 2;
    font-size: var(--community-text-secondary);
    font-weight: 600;
    line-height: 1rem;
  }

  .community-reply-context > span > :global(svg) {
    grid-row: 1 / span 2;
    grid-column: 1;
    width: 0.8rem;
    height: 0.8rem;
    margin-block-start: 0.1rem;
  }

  .community-reply-context small {
    display: block;
    grid-column: 2;
    overflow: hidden;
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
    line-height: 1rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .community-reply-context :global(.community-reply-context__close) {
    width: 1.5rem;
    height: 1.5rem;
  }

  .community-reply-context :global(.community-reply-context__close:hover),
  .community-reply-context
    :global(.community-reply-context__close:focus-visible) {
    background: color-mix(in srgb, var(--foreground) 12%, transparent);
    color: var(--foreground);
  }
</style>
