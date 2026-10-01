<script lang="ts">
  import { ComposerDrawer } from "@lapismd/design-core/ai/chat";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import PencilLineIcon from "@lucide/svelte/icons/pencil-line";
  import XIcon from "@lucide/svelte/icons/x";
  let {
    label,
    onCancel,
  }: { label?: string | undefined; onCancel?: (() => void) | undefined } =
    $props();
</script>

<ComposerDrawer
  class="community-chat-composer__context-drawer"
  role="group"
  aria-label="Editing message"
>
  <div class="community-chat-composer__context" data-ui-part="composer-context">
    <span class="community-chat-composer__context-icon"
      ><PencilLineIcon aria-hidden="true" /></span
    >
    <span class="community-chat-composer__context-copy">
      <strong>Editing message</strong>
      {#if label && label !== "Editing message"}<span title={label}
          >{label}</span
        >{/if}
    </span>
    {#if onCancel}<Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Cancel edit"
        onclick={onCancel}><XIcon aria-hidden="true" /></Button
      >{/if}
  </div>
</ComposerDrawer>

<style>
  .community-chat-composer__context {
    display: flex;
    width: 100%;
    min-width: 0;
    align-items: center;
    min-height: 2rem;
    gap: 0.65rem;
    color: var(--muted-foreground);
  }
  .community-chat-composer__context-icon {
    display: grid;
    width: 2rem;
    height: 2rem;
    flex: 0 0 auto;
    place-items: center;
    border-radius: 0.45rem;
    background: var(--muted);
    color: var(--muted-foreground);
  }

  .community-chat-composer__context-icon :global(svg) {
    width: 1rem;
    height: 1rem;
  }

  .community-chat-composer__context-copy {
    display: grid;
    min-width: 0;
    flex: 1;
    gap: 0.1rem;
  }

  .community-chat-composer__context-copy strong {
    overflow: hidden;
    color: var(--foreground);
    font-size: var(--community-text-secondary);
    font-weight: 620;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .community-chat-composer__context-copy span {
    overflow: hidden;
    font-size: var(--community-text-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
