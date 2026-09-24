<script lang="ts">
  import type { CommunityMessageModel } from "../../community/workspace-model.js";
  import { memberById } from "../../community/workspace-model.js";
  import CommunityDiscussionMessage from "../community-discussion-message/CommunityDiscussionMessage.svelte";
  import CommunityReviewReference from "../community-review-reference/CommunityReviewReference.svelte";
  import { useAgentConversation } from "../community-agent-conversation/context.svelte.js";
  let {
    message,
    highlighted = false,
  }: { message: CommunityMessageModel; highlighted?: boolean } = $props();
  const conversation = useAgentConversation();
  const event = $derived(message.sourceEvent);
</script>

{#if conversation && event}
  <CommunityDiscussionMessage
    {message}
    {highlighted}
    author={memberById(conversation.members, message.authorId)}
    members={conversation.members}
    rooms={conversation.rooms}
    replyActionLabel="Reply"
    {...conversation.memberId
      ? {
          currentMemberId: conversation.memberId,
          onReply: () => conversation.openComment(event),
          onAddReaction: (_id: string, emoji: string) =>
            conversation.react(event, emoji),
          onToggleReaction: (_id: string, emoji: string) =>
            conversation.react(event, emoji),
        }
      : {}}
  >
    {#snippet supplement()}<CommunityReviewReference
        comment={event}
      />{/snippet}
  </CommunityDiscussionMessage>
{/if}
