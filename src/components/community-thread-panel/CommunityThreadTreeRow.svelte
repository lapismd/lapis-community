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
    messages,
    index,
    members,
    focused,
    treeRow,
    transcriptComment,
    roomId,
    startEditing,
  }: {
    panel: ThreadPanelProps;
    message: CommunityMessageModel;
    messages: readonly CommunityMessageModel[];
    index: number;
    members: readonly CommunityMemberModel[];
    focused?: string;
    treeRow?: ThreadTreeRow;
    transcriptComment: boolean;
    roomId?: string;
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
        {messages}
        {index}
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
