<script lang="ts">
  import type { NostrEvent } from "../../protocol/index.js";
  import CommunityDiscussionMessage from "../community-discussion-message/CommunityDiscussionMessage.svelte";
  import CommunityChatComposer from "../community-chat-composer/CommunityChatComposer.svelte";
  import CommunityReviewReference from "../community-review-reference/CommunityReviewReference.svelte";
  import { memberById } from "../../community/workspace-model.js";
  import { useAgentConversation } from "../community-agent-conversation/context.svelte.js";
  import {
    conversationMessage,
    eventTag,
  } from "../community-agent-conversation/model.js";
  let {
    comments,
    inThread = false,
    commitDescription,
  }: {
    comments: readonly NostrEvent[];
    inThread?: boolean;
    commitDescription?: string | undefined;
  } = $props();
  const conversation = useAgentConversation();
  const target = $derived(
    inThread
      ? comments.find((comment) => comment.id === conversation?.replyCommentId)
      : undefined,
  );
  let draft = $state("");
  let error = $state("");
  let busy = $state(false);
  async function reply(content: string) {
    if (!target || !conversation || busy || !content.trim()) return;
    busy = true;
    try {
      await conversation.publish({
        kind: 1111,
        created_at: Math.floor(Date.now() / 1000),
        content,
        tags: [
          ...target.tags.filter(([key]) => !["e", "k", "p"].includes(key!)),
          ["e", target.id],
          ["k", "1111"],
          ["p", target.pubkey],
        ],
      });
      conversation.clearCommentReply();
      draft = "";
      error = "";
    } catch (cause) {
      error = String(cause);
    } finally {
      busy = false;
    }
  }
</script>

{#each comments as comment (comment.id)}
  <CommunityDiscussionMessage
    highlighted={inThread && comment.id === conversation?.replyCommentId}
    message={conversationMessage(
      comment,
      conversation?.events ?? [],
      conversation?.memberId,
    )}
    author={memberById(conversation?.members ?? [], comment.pubkey)}
    members={conversation?.members ?? []}
    {...conversation?.memberId
      ? {
          currentMemberId: conversation.memberId,
          onReply: () => conversation.openComment(comment),
          onAddReaction: (_id: string, emoji: string) =>
            conversation.react(comment, emoji),
          onToggleReaction: (_id: string, emoji: string) =>
            conversation.react(comment, emoji),
        }
      : {}}
  >
    {#snippet supplement()}
      <CommunityReviewReference {comment} description={commitDescription} />
    {/snippet}
  </CommunityDiscussionMessage>
{/each}
{#if target}<CommunityChatComposer
    disabled={busy}
    bind:value={draft}
    mode="form"
    showSubmitButton
    ariaLabel="Reply to review comment"
    submitLabel="Reply"
    onSubmit={(submission) => reply(submission.content)}
  />{/if}
{#if error}<p role="alert">{error}</p>{/if}
