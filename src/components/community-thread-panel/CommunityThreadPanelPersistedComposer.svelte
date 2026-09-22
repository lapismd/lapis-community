<script lang="ts">
  import type { ComposerStatus } from "@lapismd/design-core/ai/chat";
  import { untrack } from "svelte";

  import type {
    CommunityCustomEmoji,
    CommunityReplyTarget,
  } from "../../community/index.js";
  import { createBrowserCommunityComposerDraftStore } from "../community-chat-composer/browser-draft-store.js";
  import type {
    CommunityComposerAgentModel,
    CommunityComposerAudienceScope,
  } from "../community-chat-composer/composer-agent-model.js";
  import CommunityPersistedComposer from "../community-chat-composer/CommunityPersistedComposer.svelte";
  import type {
    CommunityMemberModel,
    CommunityMessageModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";
  import {
    communityThreadComposerDraftKey,
    threadComposerRoomId,
  } from "./thread-draft-key.js";

  let {
    value = $bindable(""),
    members,
    rooms,
    agents = [],
    currentMemberId,
    rootMessageId,
    rootMessage,
    rootAuthorName,
    editingMessageId,
    replyTarget,
    communityEmojis = [],
    disabled = false,
    disabledReason = "Reconnect to reply",
    composerStatus,
    audience,
    initialAgentPubkeys,
    onOpenProfile,
    onMessageMember,
    onWaveMember,
    onRetryComposerStatus,
    onDismissComposerStatus,
    onCancelContext,
    onSubmit,
  }: {
    value?: string;
    members: CommunityMemberModel[];
    rooms: readonly CommunityRoomModel[];
    agents?: readonly CommunityComposerAgentModel[];
    currentMemberId?: string;
    rootMessageId: string;
    rootMessage?: CommunityMessageModel;
    rootAuthorName?: string;
    editingMessageId?: string;
    replyTarget?: CommunityReplyTarget;
    communityEmojis?: readonly CommunityCustomEmoji[];
    disabled?: boolean;
    disabledReason?: string;
    composerStatus?: ComposerStatus;
    audience?: CommunityComposerAudienceScope;
    initialAgentPubkeys?: readonly string[];
    onOpenProfile?: (member: CommunityMemberModel) => void;
    onMessageMember?: (member: CommunityMemberModel) => void | Promise<void>;
    onWaveMember?: (member: CommunityMemberModel) => void | Promise<void>;
    onRetryComposerStatus?: () => void | Promise<void>;
    onDismissComposerStatus?: () => void;
    onCancelContext?: () => void;
    onSubmit: (submission: {
      content: string;
      mentionPubkeys: readonly string[];
    }) => void | Promise<void>;
  } = $props();

  const draftStore = untrack(() =>
    typeof window === "undefined"
      ? undefined
      : createBrowserCommunityComposerDraftStore(),
  );
  const draftKey = $derived(
    communityThreadComposerDraftKey({
      viewer: currentMemberId,
      roomId: threadComposerRoomId(rooms, rootMessage, replyTarget?.roomId),
      rootMessageId,
    }),
  );
</script>

<CommunityPersistedComposer
  bind:value
  {draftKey}
  {...draftStore === undefined ? {} : { draftStore }}
  {members}
  {agents}
  {...audience === undefined ? {} : { audience }}
  {...initialAgentPubkeys === undefined ? {} : { initialAgentPubkeys }}
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
  ariaLabel="Thread reply composer"
  submitLabel="Send reply"
  placeholder={rootAuthorName === undefined
    ? "Reply to thread"
    : `Reply in thread to ${rootAuthorName}`}
  {...composerStatus === undefined ? {} : { composerStatus }}
  {...onRetryComposerStatus === undefined ? {} : { onRetryComposerStatus }}
  {...onDismissComposerStatus === undefined ? {} : { onDismissComposerStatus }}
  {...onCancelContext === undefined ? {} : { onCancelContext }}
  {onSubmit}
/>
