<script lang="ts">
  import type { ComposerStatus } from "@lapismd/design-core/ai/chat";
  import type {
    CommunityCustomEmoji,
    CommunityReplyTarget,
  } from "../../community/index.js";
  import CommunityAgentComposerActivity from "../community-agent-composer-activity/CommunityAgentComposerActivity.svelte";
  import type { CommunityComposerAgentModel } from "../community-chat-composer/composer-agent-model.js";
  import CommunityThreadPanelPersistedComposer from "./CommunityThreadPanelPersistedComposer.svelte";
  import type { CommunityAgentActivityContext } from "../../community/agent-contracts.js";
  import type {
    CommunityMemberModel,
    CommunityMessageModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";
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
  }: {
    value?: string;
    members: readonly CommunityMemberModel[];
    rooms: readonly CommunityRoomModel[];
    agents?: readonly CommunityComposerAgentModel[];
    currentMemberId?: string | undefined;
    rootMessageId: string;
    rootMessage?: CommunityMessageModel | undefined;
    rootAuthorName?: string | undefined;
    editingMessageId?: string | undefined;
    replyTarget?: CommunityReplyTarget | undefined;
    communityEmojis?: readonly CommunityCustomEmoji[];
    activityContext?: CommunityAgentActivityContext | undefined;
    disabled?: boolean;
    disabledReason?: string;
    composerStatus?: ComposerStatus | undefined;
    onSendReply?:
      | ((
          rootMessageId: string,
          content: string,
          mentionPubkeys?: readonly string[],
        ) => void | Promise<void>)
      | undefined;
    onSaveMessageEdit?:
      | ((messageId: string, content: string) => void | Promise<void>)
      | undefined;
    onCancelReply?: (() => void) | undefined;
    onOpenProfile?: ((member: CommunityMemberModel) => void) | undefined;
    onMessageMember?:
      | ((member: CommunityMemberModel) => void | Promise<void>)
      | undefined;
    onWaveMember?:
      | ((member: CommunityMemberModel) => void | Promise<void>)
      | undefined;
    onRetryComposerStatus?: (() => void | Promise<void>) | undefined;
    onDismissComposerStatus?: (() => void) | undefined;
  } = $props();

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
  {...replyTarget === undefined ? {} : { replyTarget }}
  {...threadComposer.audience === undefined
    ? {}
    : { audience: threadComposer.audience }}
  initialAgentPubkeys={threadComposer.initialAgentPubkeys}
  {...onOpenProfile === undefined ? {} : { onOpenProfile }}
  {...onMessageMember === undefined ? {} : { onMessageMember }}
  {...onWaveMember === undefined ? {} : { onWaveMember }}
  {...composerStatus === undefined ? {} : { composerStatus }}
  {...onRetryComposerStatus === undefined ? {} : { onRetryComposerStatus }}
  {...onDismissComposerStatus === undefined ? {} : { onDismissComposerStatus }}
  {...editingMessageId === undefined && onCancelReply === undefined
    ? {}
    : { onCancelContext: cancelComposerContext }}
  onSubmit={(submission) =>
    submitComposer(submission.content, submission.mentionPubkeys)}
/>
{#if activityContext}<CommunityAgentComposerActivity
    context={activityContext}
  />{/if}
