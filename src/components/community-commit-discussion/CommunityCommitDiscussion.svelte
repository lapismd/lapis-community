<script lang="ts">
  import type { NostrEvent } from "../../protocol/index.js";
  import CommunityMessage from "../community-message/CommunityMessage.svelte";
  import CommunityChatComposer from "../community-chat-composer/CommunityChatComposer.svelte";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import { memberById } from "../../community/workspace-model.js";
  import { useAgentConversation } from "../community-agent-conversation/context.svelte.js";
  import {
    conversationMessage,
    eventTag,
  } from "../community-agent-conversation/model.js";
  import { projectRouteToHash } from "../community-application/project-route.js";
  let {
    comments,
    inThread = false,
  }: { comments: readonly NostrEvent[]; inThread?: boolean } = $props();
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
  <CommunityMessage
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
      <CommunityChip
        size="compact"
        href={projectRouteToHash({
          kind: "repository",
          coordinate: eventTag(comment, "a")!,
          surface: "commits",
          commitSha: eventTag(comment, "c")!,
        })}
      >
        {eventTag(comment, "file")
          ? `${eventTag(comment, "file")}:${eventTag(comment, "line")}`
          : "Commit review"} · {eventTag(comment, "c")?.slice(0, 12)}
      </CommunityChip>
    {/snippet}
  </CommunityMessage>
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
