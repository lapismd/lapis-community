<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { ConfirmButton } from "@lapismd/design-core/forms/dialog";
  import type { CommunityChannelCanvasModel } from "../../community/channel-canvas.js";
  import CommunityMarkdownContent from "../community-markdown-content/CommunityMarkdownContent.svelte";
  import CommunityChatComposer from "../community-chat-composer/CommunityChatComposer.svelte";
  import CommunitySkeleton from "../community-skeleton/CommunitySkeleton.svelte";

  let {
    canvas,
    initialContent = "",
    onSave,
    onReload,
  }: {
    canvas: CommunityChannelCanvasModel;
    initialContent?: string;
    onSave: (content: string, expectedEventId: string | null) => Promise<void>;
    onReload: () => Promise<void>;
  } = $props();
  let editing = $state(false);
  let draft = $state("");
  let startingRevision = $state<string | null>(null);
  let pending = $state(false);
  let error = $state("");
  let review = $state(false);
  const stale = $derived(editing && canvas.eventId !== startingRevision);

  function edit() {
    draft = canvas.content || initialContent;
    startingRevision = canvas.eventId;
    editing = true;
    review = false;
    error = "";
  }
  async function save(content = draft, revision = startingRevision) {
    pending = true;
    error = "";
    try {
      await onSave(content, revision);
      editing = false;
      review = false;
    } catch (cause) {
      error =
        cause instanceof Error ? cause.message : "Canvas could not be saved";
      throw cause;
    } finally {
      pending = false;
    }
  }
  async function reload() {
    try {
      await onReload();
    } catch (cause) {
      error =
        cause instanceof Error ? cause.message : "Canvas could not be loaded";
    }
  }
</script>

<div
  class="lc-channel-canvas"
  class:lc-channel-canvas--editing={editing}
  aria-busy={pending || canvas.loading}
>
  {#if canvas.loading && canvas.eventId === null && !editing}
    <CommunitySkeleton layout="details" label="Loading canvas" />
  {:else}
    {#if canvas.error}<p role="alert">{canvas.error}</p>
      <Button variant="outline" onclick={reload}>Retry loading</Button>{/if}
    {#if error}<p role="alert">{error}</p>{/if}
    {#if editing}
      {#if stale}
        <p role="status">
          The canvas changed while you were editing. Your draft is retained.
        </p>
        <Button
          variant="outline"
          onclick={() => {
            review = true;
          }}>Review latest canvas</Button
        >
        {#if review}
          <section aria-label="Latest canvas">
            <CommunityMarkdownContent content={canvas.content} />
            <Button
              variant="outline"
              onclick={() => {
                startingRevision = canvas.eventId;
                review = false;
              }}>Keep draft against this version</Button
            >
          </section>
        {/if}
      {/if}
      <form
        class="lc-channel-canvas__form"
        onsubmit={(event) => {
          event.preventDefault();
          void save().catch(() => undefined);
        }}
      >
        <CommunityChatComposer
          class="lc-channel-canvas__composer"
          mode="form"
          bind:value={draft}
          ariaLabel="Canvas Markdown"
          disabled={pending}
        />
        <div class="lc-channel-canvas__actions">
          <Button type="submit" disabled={pending || stale || !canvas.canEdit}
            >{pending ? "Saving…" : "Save canvas"}</Button
          >
          <Button
            variant="ghost"
            disabled={pending}
            onclick={() => {
              editing = false;
              error = "";
            }}>Cancel</Button
          >
        </div>
      </form>
    {:else}
      {#if canvas.content}
        <CommunityMarkdownContent content={canvas.content} />
      {:else}
        <p>
          No canvas yet. Use this shared document for channel notes and context.
        </p>
      {/if}
      {#if canvas.canEdit}
        <div class="lc-channel-canvas__actions">
          <Button
            variant="outline"
            disabled={pending || canvas.loading}
            onclick={edit}
            >{canvas.content ? "Edit canvas" : "Create canvas"}</Button
          >
          {#if canvas.content}
            <ConfirmButton
              title="Clear canvas?"
              description="This publishes an empty canvas. Previous snapshots remain in relay history."
              confirmLabel="Clear canvas"
              destructive
              onConfirm={() => save("", canvas.eventId)}
              >Clear canvas</ConfirmButton
            >
          {/if}
        </div>
      {/if}
    {/if}
  {/if}
</div>

<style>
  .lc-channel-canvas {
    box-sizing: border-box;
    display: grid;
    gap: 1rem;
    min-width: 0;
    padding-block-end: 1rem;
    overflow-wrap: anywhere;
  }
  .lc-channel-canvas--editing,
  .lc-channel-canvas__form {
    height: 100%;
    min-height: 0;
  }
  .lc-channel-canvas__form {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
  }
  :global(.lc-channel-canvas__composer) {
    --community-chat-composer-editor-max-height-override: 100%;
    height: 100%;
    min-height: 0;
  }
  :global(
      .lc-channel-canvas__composer > [data-ui-component="ai-chat-composer"]
    ),
  :global(
      .lc-channel-canvas__composer
        > [data-ui-component="ai-chat-composer"]
        > [data-ui-part="body"]
    ),
  :global(
      .lc-channel-canvas__composer
        [data-ui-component="ai-chat-composer"]
        [data-ui-part="input-area"]
    ),
  :global(.lc-channel-canvas__composer .community-chat-composer__editor-wrap),
  :global(
      .lc-channel-canvas__composer
        .community-chat-composer__editor-scroll-area[data-ui-component="scroll-area"]
    ),
  :global(
      .lc-channel-canvas__composer
        .community-chat-composer__editor-scroll-area
        > [data-ui-part="scroll-area-viewport"]
    ) {
    height: 100%;
    min-height: 0;
  }
  :global(
      .lc-channel-canvas__composer
        > [data-ui-component="ai-chat-composer"]
        > [data-ui-part="body"]
    ),
  :global(
      .lc-channel-canvas__composer
        [data-ui-component="ai-chat-composer"]
        [data-ui-part="input-area"]
    ),
  :global(.lc-channel-canvas__composer .community-chat-composer__editor-wrap) {
    flex: 1;
    min-height: 0;
  }
  .lc-channel-canvas__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 1rem;
  }
</style>
