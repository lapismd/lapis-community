<script lang="ts">
  import { MessageMetadata } from "@lapismd/design-core/ai/chat";

  import type {
    CommunityMemberModel,
    CommunityMessageModel,
  } from "../community-workspace/model.js";

  import CommunityMessageMentionAvatars from "./CommunityMessageMentionAvatars.svelte";
  import CommunityMessageReplySummary from "./CommunityMessageReplySummary.svelte";
  import { implicitTaggedMentionMembers } from "./implicit-mentions.js";

  let {
    message,
    members = [],
    isContinuation = false,
    replyParticipants = [],
    onOpenThread,
    onOpenProfile,
    onMessageMember,
    onWaveMember,
    onViewMemberActivity,
  }: {
    message: CommunityMessageModel;
    members?: readonly CommunityMemberModel[];
    isContinuation?: boolean;
    replyParticipants?: readonly CommunityMemberModel[];
    onOpenThread?: (messageId: string) => void;
    onOpenProfile?: (member: CommunityMemberModel) => void;
    onMessageMember?: (member: CommunityMemberModel) => void | Promise<void>;
    onWaveMember?: (member: CommunityMemberModel) => void | Promise<void>;
    onViewMemberActivity?: (
      member: CommunityMemberModel,
    ) => void | Promise<void>;
  } = $props();

  const replyLabel = $derived.by(() => {
    const replyCount = message.replyCount ?? 0;
    return (
      message.replyLabel ??
      `${replyCount} ${replyCount === 1 ? "reply" : "replies"}`
    );
  });
  const showReplySummary = $derived(
    (message.replyCount ?? 0) > 0 && onOpenThread !== undefined,
  );
  const implicitMentions = $derived(
    implicitTaggedMentionMembers(message, members),
  );
</script>

<div class="community-message__metadata">
  {#if !isContinuation}
    <MessageMetadata timestamp={message.timestamp} />
  {/if}
  <CommunityMessageMentionAvatars
    members={implicitMentions}
    {...onOpenProfile === undefined ? {} : { onOpenProfile }}
    {...onMessageMember === undefined ? {} : { onMessageMember }}
    {...onWaveMember === undefined ? {} : { onWaveMember }}
    {...onViewMemberActivity === undefined ? {} : { onViewMemberActivity }}
  />
  {#if message.edited}<span>(edited)</span>{/if}
  {#if showReplySummary}
    <CommunityMessageReplySummary
      label={replyLabel}
      participants={replyParticipants}
      onOpenThread={onOpenThread ? () => onOpenThread(message.id) : undefined}
      {onOpenProfile}
      {onMessageMember}
      {onWaveMember}
      {onViewMemberActivity}
    />
  {/if}
</div>

<style>
  .community-message__metadata {
    display: flex;
    min-height: 1.5rem;
    align-items: center;
    gap: 0.4rem;
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
    line-height: 1;
  }

  .community-message__metadata
    :global([data-ui-component="ai-chat-message-metadata"]) {
    min-height: 1.5rem;
    margin-top: 0;
    line-height: 1;
  }
</style>
