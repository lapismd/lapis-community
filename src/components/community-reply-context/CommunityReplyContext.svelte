<script lang="ts">
  import { ComposerDrawer } from "@lapismd/design-core/ai/chat";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import CommunityReplyPreview from "../community-reply-preview/CommunityReplyPreview.svelte";
  import XIcon from "@lucide/svelte/icons/x";

  import type { CommunityReplyTarget } from "../../community/index.js";

  let {
    target,
    onCancel,
  }: {
    target: Pick<CommunityReplyTarget, "authorName" | "content">;
    onCancel?: () => void;
  } = $props();
</script>

<ComposerDrawer
  class="community-reply-context__drawer"
  role="group"
  aria-label={`Replying to ${target.authorName}`}
>
  <div class="community-reply-context">
    <CommunityReplyPreview {target} />
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
