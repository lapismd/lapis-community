<script lang="ts">
  import CommunityAgentThreadContext from "../community-agent-thread-context/CommunityAgentThreadContext.svelte";
  import CommunityTranscriptCommentMessage from "../community-transcript-comment-message/CommunityTranscriptCommentMessage.svelte";
  import type {
    CommunityMemberModel,
    CommunityMessageModel,
  } from "../community-workspace/model.js";
  import CommunityThreadMessage from "./CommunityThreadMessage.svelte";
  import type { ThreadPanelProps } from "./props.js";
  import type { ThreadTreeRow } from "./thread-tree-layout.js";

  let {
    panel,
    message,
    isContinuation,
    members,
    focused,
    treeRow,
    transcriptComment,
    roomId,
    startEditing,
  }: {
    panel: ThreadPanelProps;
    message: CommunityMessageModel;
    isContinuation: boolean;
    members: readonly CommunityMemberModel[];
    focused?: string | undefined;
    treeRow?: ThreadTreeRow | undefined;
    transcriptComment: boolean;
    roomId?: string | undefined;
    startEditing(id: string): void;
  } = $props();
</script>

<div
  class="community-thread-tree-row"
  data-ui-part="thread-tree-row"
  data-thread-depth={treeRow?.depth ?? 0}
  style={`--community-thread-indent: ${treeRow?.indentRem ?? 0}rem; --community-thread-connector-indent: ${treeRow?.connectorIndentRem ?? 0}rem;`}
>
  {#each treeRow?.guideIndentRems ?? [] as guideIndent}
    <span
      class="community-thread-tree-row__guide"
      data-ui-part="thread-reply-guide"
      style={`--community-thread-guide-indent: ${guideIndent}rem;`}
      aria-hidden="true"
    ></span>
  {/each}
  {#if treeRow?.connectorIndentRem !== undefined}
    <span
      class="community-thread-tree-row__connector"
      data-ui-part="thread-reply-connector"
      aria-hidden="true"
    ></span>
  {/if}
  {#if treeRow?.connectsToChildren}
    <span
      class="community-thread-tree-row__descendant-guide"
      data-ui-part="thread-descendant-guide"
      aria-hidden="true"
    ></span>
  {/if}
  <div class="community-thread-tree-row__content">
    {#if transcriptComment}
      <CommunityTranscriptCommentMessage
        {message}
        highlighted={message.id === focused}
      />
    {:else}
      <CommunityThreadMessage
        {panel}
        {message}
        {isContinuation}
        {members}
        {focused}
        {startEditing}
      />
    {/if}
    <CommunityAgentThreadContext
      messageId={message.id}
      rootId={panel.thread.rootMessageId}
      {roomId}
    />
  </div>
</div>

<style>
  .community-thread-tree-row {
    --community-thread-avatar-center: 1.125rem;
    --community-thread-guide-bleed: 0.25rem;
    --community-thread-guide-color: color-mix(
      in srgb,
      var(--border) 58%,
      transparent
    );

    position: relative;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    padding-inline-start: var(--community-thread-indent);
  }

  .community-thread-tree-row__content {
    position: relative;
    z-index: 1;
    min-width: 0;
  }

  .community-thread-tree-row__guide,
  .community-thread-tree-row__connector,
  .community-thread-tree-row__descendant-guide {
    position: absolute;
    z-index: 0;
    pointer-events: none;
  }

  .community-thread-tree-row__guide {
    inset-block: calc(-1 * var(--community-thread-guide-bleed));
    inset-inline-start: calc(
      var(--community-thread-guide-indent) +
        var(--community-thread-avatar-center)
    );
    border-inline-start: 1.5px solid var(--community-thread-guide-color);
  }

  .community-thread-tree-row__connector {
    inset-block-start: calc(-1 * var(--community-thread-guide-bleed));
    inset-inline-start: calc(
      var(--community-thread-connector-indent) +
        var(--community-thread-avatar-center)
    );
    width: calc(
      var(--community-thread-indent) - var(--community-thread-connector-indent) -
        var(--community-thread-avatar-center) - 0.25rem
    );
    height: calc(
      var(--community-thread-avatar-center) +
        var(--community-thread-guide-bleed)
    );
    border-block-end: 1.5px solid var(--community-thread-guide-color);
    border-inline-start: 1.5px solid var(--community-thread-guide-color);
    border-end-start-radius: 1rem;
  }

  .community-thread-tree-row__descendant-guide {
    inset-block-start: var(--community-thread-avatar-center);
    inset-block-end: calc(-1 * var(--community-thread-guide-bleed));
    inset-inline-start: calc(
      var(--community-thread-indent) + var(--community-thread-avatar-center)
    );
    border-inline-start: 1.5px solid var(--community-thread-guide-color);
  }
</style>
