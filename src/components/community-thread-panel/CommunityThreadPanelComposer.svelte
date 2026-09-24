<script lang="ts">
  import type { ConversationComposerTarget } from "../community-agent-conversation/transcript-reply-target.js";
  import type { ThreadPanelComposerProps } from "./thread-panel-composer-props.js";
  import { useAgentConversation } from "../community-agent-conversation/context.svelte.js";
  import CommunityTranscriptReplyComposer from "../community-transcript-reply-composer/CommunityTranscriptReplyComposer.svelte";
  import CommunityAgentComposerActivity from "../community-agent-composer-activity/CommunityAgentComposerActivity.svelte";
  import CommunityThreadPanelPersistedComposer from "./CommunityThreadPanelPersistedComposer.svelte";
  import {
    sendThreadContent,
    threadComposerAudience,
  } from "./thread-composer-audience.js";

  let {
    value = $bindable(""),
    members,
    rooms,
    agents = [],
    currentMemberId,
    rootMessageId,
    rootMessage,
    rootAuthorName,
    editingMessageId = $bindable(),
    replyTarget,
    communityEmojis = [],
    activityContext,
    disabled = false,
    disabledReason = "Reconnect to reply",
    composerStatus,
    onSendReply,
    onSaveMessageEdit,
    onCancelReply,
    onOpenProfile,
    onMessageMember,
    onWaveMember,
    onRetryComposerStatus,
    onDismissComposerStatus,
  }: ThreadPanelComposerProps = $props();

  const conversation = useAgentConversation();
  const composerTarget = $derived<ConversationComposerTarget | undefined>(
    conversation?.replies.selected?.rootId === rootMessageId
      ? conversation.replies.selected
      : replyTarget
        ? { kind: "message", target: replyTarget }
        : undefined,
  );

  const threadComposer = $derived(
    threadComposerAudience(
      currentMemberId,
      rooms,
      rootMessage,
      rootMessageId,
      agents,
    ),
  );

  function cancelComposerContext(): void {
    if (editingMessageId !== undefined) {
      editingMessageId = undefined;
      value = "";
      return;
    }
    onCancelReply?.();
  }

  async function submitComposer(
    content: string,
    mentionPubkeys: readonly string[] = [],
  ): Promise<void> {
    if (editingMessageId !== undefined && onSaveMessageEdit !== undefined) {
      await onSaveMessageEdit(editingMessageId, content);
      editingMessageId = undefined;
      return;
    }
    await sendThreadContent(
      onSendReply,
      rootMessageId,
      content,
      mentionPubkeys,
    );
  }
</script>

{#if composerTarget && composerTarget.kind !== "message" && conversation}
  {#key composerTarget.key}<CommunityTranscriptReplyComposer
      target={composerTarget}
      {conversation}
      {disabled}
    />{/key}
{:else}
  <CommunityThreadPanelPersistedComposer
    bind:value
    {members}
    {agents}
    {rooms}
    {communityEmojis}
    {rootMessageId}
    {disabled}
    {disabledReason}
    {...currentMemberId === undefined ? {} : { currentMemberId }}
    {...rootMessage === undefined ? {} : { rootMessage }}
    {...rootAuthorName === undefined ? {} : { rootAuthorName }}
    {...editingMessageId === undefined ? {} : { editingMessageId }}
    {...composerTarget?.kind === "message"
      ? { replyTarget: composerTarget.target }
      : {}}
    {...threadComposer.audience === undefined
      ? {}
      : { audience: threadComposer.audience }}
    initialAgentPubkeys={threadComposer.initialAgentPubkeys}
    {...onOpenProfile === undefined ? {} : { onOpenProfile }}
    {...onMessageMember === undefined ? {} : { onMessageMember }}
    {...onWaveMember === undefined ? {} : { onWaveMember }}
    {...composerStatus === undefined ? {} : { composerStatus }}
    {...onRetryComposerStatus === undefined ? {} : { onRetryComposerStatus }}
    {...onDismissComposerStatus === undefined
      ? {}
      : { onDismissComposerStatus }}
    {...editingMessageId === undefined && onCancelReply === undefined
      ? {}
      : { onCancelContext: cancelComposerContext }}
    onSubmit={(submission) =>
      submitComposer(submission.content, submission.mentionPubkeys)}
  />
{/if}
{#if activityContext}<CommunityAgentComposerActivity
    context={activityContext}
  />{/if}
