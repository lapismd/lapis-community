<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import FileIcon from "@lucide/svelte/icons/file";
  import type { FileDiffLineContext } from "@lapismd/design-core/diff";

  import type { CommunityCustomEmoji } from "../../community/index.js";
  import type { PullRequestComment } from "../../projects/index.js";
  import CommunityChatComposer from "../community-chat-composer/CommunityChatComposer.svelte";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunityMessage from "../community-message/CommunityMessage.svelte";
  import type {
    CommunityMemberModel,
    CommunityMessageModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";

  let {
    context,
    comments,
    showComposer = false,
    composerContent = $bindable(""),
    busy = false,
    canCollaborate = false,
    members = [],
    rooms = [],
    communityEmojis = [],
    currentMemberId,
    memberForPubkey,
    commentMessage,
    canReact,
    reactionOptions,
    onToggleReaction,
    onCancelComposer,
    onSubmitComposer,
    linePrefix,
  }: {
    context: FileDiffLineContext;
    comments: readonly PullRequestComment[];
    showComposer?: boolean | undefined;
    composerContent?: string | undefined;
    busy?: boolean | undefined;
    canCollaborate?: boolean | undefined;
    members?: readonly CommunityMemberModel[] | undefined;
    rooms?: readonly CommunityRoomModel[] | undefined;
    communityEmojis?: readonly CommunityCustomEmoji[] | undefined;
    currentMemberId?: string | undefined;
    memberForPubkey: (pubkey: string) => CommunityMemberModel;
    commentMessage: (comment: PullRequestComment) => CommunityMessageModel;
    canReact: (comment: PullRequestComment) => boolean;
    reactionOptions: (comment: PullRequestComment) => readonly string[] | undefined;
    onToggleReaction: (comment: PullRequestComment, emoji: string) => void;
    onCancelComposer: () => void;
    onSubmitComposer: (content: string) => void;
    linePrefix: string;
  } = $props();
</script>

{#if comments.length > 0 || showComposer}
  <div
    class="community-projects__inline-thread"
    aria-label={`Discussion on ${context.path} line ${context.lineNumber}`}
  >
    {#each comments as comment (comment.event.id)}
      {@const commentReactionOptions = reactionOptions(comment)}
      {#snippet inlineLabels()}
        <div class="community-projects__message-labels">
          {#if comment.decision}<CommunityChip
              size="compact"
              tone={comment.decision === "approved" ? "success" : "warning"}
              >{comment.decision}</CommunityChip
            >{/if}
        </div>
      {/snippet}
      <CommunityMessage
        message={commentMessage(comment)}
        author={memberForPubkey(comment.event.pubkey)}
        {members}
        {rooms}
        {communityEmojis}
        {...currentMemberId === undefined ? {} : { currentMemberId }}
        supplement={inlineLabels}
        density="compact"
        {...canReact(comment)
          ? {
              onAddReaction: (_messageId: string, emoji: string) =>
                onToggleReaction(comment, emoji),
              onToggleReaction: (_messageId: string, emoji: string) =>
                onToggleReaction(comment, emoji),
            }
          : {}}
        {...commentReactionOptions === undefined
          ? {}
          : { reactionOptions: commentReactionOptions }}
      />
    {/each}
    {#if showComposer}
      <div class="community-projects__inline-context">
        <FileIcon aria-hidden="true" />
        <span>{context.path}</span>
        <CommunityChip size="compact">{linePrefix}{context.lineNumber}</CommunityChip>
      </div>
      <CommunityChatComposer
        class="community-projects__inline-composer"
        bind:value={composerContent}
        placeholder="Leave a comment on this line…"
        ariaLabel={`Comment on ${context.path} line ${context.lineNumber}`}
        submitLabel="Comment"
        {members}
        {rooms}
        {communityEmojis}
        {...currentMemberId === undefined ? {} : { currentMemberId }}
        {busy}
        disabled={!canCollaborate}
        disabledReason="Sign in to comment on this review"
        onCancel={onCancelComposer}
        onSubmit={(submission) => onSubmitComposer(submission.content)}
      />
    {/if}
  </div>
{/if}
