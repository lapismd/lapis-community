<script lang="ts">
  import type { ComposerStatus } from "@lapismd/design-core/ai/chat";
  import { untrack, type Snippet } from "svelte";

  import type { CommunityAgentActivityContext } from "../../community/agent-contracts.js";
  import type {
    CommunityCustomEmoji,
    CommunityReplyTarget,
    CommunityTimelinePresentation,
    CommunityTimelinePosition,
  } from "../../community/index.js";
  import CommunityAgentComposerActivity from "../community-agent-composer-activity/CommunityAgentComposerActivity.svelte";
  import { createBrowserCommunityComposerDraftStore } from "../community-chat-composer/browser-draft-store.js";
  import type { CommunityComposerAgentModel } from "../community-chat-composer/composer-agent-model.js";
  import CommunityPersistedComposer from "../community-chat-composer/CommunityPersistedComposer.svelte";
  import type {
    CommunityMemberModel,
    CommunityMessageModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";
  import { createConversationDraft } from "./conversation-draft.svelte.js";
  import { sendConversationContent } from "./conversation-send.js";

  let {
    room,
    draftKey,
    presentation,
    onPresentationChange,
    rooms,
    members,
    directMember,
    agents = [],
    onSend,
    communityEmojis = [],
    replyTarget,
    onOpenProfile,
    onMessageMember,
    onWaveMember,
    onCancelReply,
    disabled = false,
    disabledReason = "Reconnect to send messages",
    composerStatus,
    onRetryComposerStatus,
    onDismissComposerStatus,
    currentMemberId,
    activityContext,
    footer,
    onSaveMessageEdit,
  }: {
    room: CommunityRoomModel;
    draftKey: string;
    presentation?: CommunityTimelinePresentation;
    onPresentationChange?: (
      key: string,
      update: { draft?: string; position?: CommunityTimelinePosition },
    ) => void;
    rooms: readonly CommunityRoomModel[];
    members: CommunityMemberModel[];
    directMember?: CommunityMemberModel;
    agents?: readonly CommunityComposerAgentModel[];
    onSend?: (
      content: string,
      mentionPubkeys?: readonly string[],
    ) => void | Promise<void>;
    communityEmojis?: readonly CommunityCustomEmoji[];
    replyTarget?: CommunityReplyTarget;
    onOpenProfile?: (member: CommunityMemberModel) => void;
    onMessageMember?: (member: CommunityMemberModel) => void | Promise<void>;
    onWaveMember?: (member: CommunityMemberModel) => void | Promise<void>;
    onCancelReply?: () => void;
    disabled?: boolean;
    disabledReason?: string;
    composerStatus?: ComposerStatus;
    onRetryComposerStatus?: () => void | Promise<void>;
    onDismissComposerStatus?: () => void;
    currentMemberId?: string;
    activityContext?: CommunityAgentActivityContext;
    footer?: Snippet;
    onSaveMessageEdit?: (
      messageId: string,
      content: string,
    ) => void | Promise<void>;
  } = $props();

  const draftStore = untrack(() =>
    typeof window === "undefined"
      ? undefined
      : createBrowserCommunityComposerDraftStore(),
  );
  let editingMessageId = $state<string>();
  const draft = createConversationDraft({
    key: () => draftKey,
    identity: () => currentMemberId,
    presentation: () => presentation,
    persist: () => draftStore !== undefined,
    changed: (key, value) => onPresentationChange?.(key, { draft: value }),
    onIdentityChange() {
      editingMessageId = undefined;
    },
  });

  export function startEditing(message: CommunityMessageModel): void {
    editingMessageId = message.id;
    draft.value = message.content;
  }

  function cancelComposerContext(): void {
    if (editingMessageId !== undefined) {
      editingMessageId = undefined;
      draft.value = "";
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
    await sendConversationContent(onSend, content, mentionPubkeys);
  }
</script>

{#if footer}
  {@render footer()}
{:else}
  <CommunityPersistedComposer
    bind:value={draft.value}
    {draftKey}
    {...draftStore === undefined ? {} : { draftStore }}
    {members}
    {agents}
    {rooms}
    {communityEmojis}
    {...currentMemberId === undefined ? {} : { currentMemberId }}
    {...onOpenProfile === undefined ? {} : { onOpenMember: onOpenProfile }}
    {...onMessageMember === undefined ? {} : { onMessageMember }}
    {...onWaveMember === undefined ? {} : { onWaveMember }}
    {...editingMessageId !== undefined
      ? {
          context: {
            kind: "edit" as const,
            id: editingMessageId,
            label: "Editing message",
          },
        }
      : replyTarget === undefined
        ? {}
        : { context: { kind: "reply" as const, target: replyTarget } }}
    {disabled}
    {disabledReason}
    placeholder={`Message ${room.kind === "channel" ? "#" : ""}${room.name}`}
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
<CommunityAgentComposerActivity
  context={activityContext ??
    (room.kind === "direct"
      ? {
          kind: "dm",
          ...(directMember ? { agentPubkey: directMember.id } : {}),
        }
      : { kind: "channel", channelId: room.groupId ?? room.id })}
/>
