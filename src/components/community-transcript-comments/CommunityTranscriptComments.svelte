<script lang="ts">
  import type { Snippet } from "svelte";
  import type { TranscriptCommentPart } from "../../protocol/transcript-comment-anchor.js";
  import { buildCommunityMessageLink } from "../../community/community-links.js";
  import { transcriptReactions } from "../../projects/transcript-reactions.js";
  import { useAgentConversation } from "../community-agent-conversation/context.svelte.js";
  import type { TranscriptCommentSource } from "../community-agent-conversation/transcript-comment-sources.js";
  import { durableDraftTarget } from "../community-agent-conversation/transcript-comment-draft.js";
  import CommunityMessageActions from "../community-message-actions/CommunityMessageActions.svelte";
  import { createMessageActionHover } from "../community-message-actions/message-action-hover.svelte.js";
  import CommunityReactions from "../community-reactions/CommunityReactions.svelte";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import { formatCommunityEventCopy } from "../community-message/copy-event.js";
  import { focusTranscriptItem } from "./focus-transcript-item.js";
  let {
    source,
    related = [],
    part,
    label = "Transcript item",
    text,
    children,
  }: {
    source?: TranscriptCommentSource | undefined;
    related?: readonly TranscriptCommentSource[];
    part?: TranscriptCommentPart;
    label?: string;
    text: string;
    children: Snippet;
  } = $props();
  const conversation = useAgentConversation();
  const hover = createMessageActionHover();
  const durable = $derived(
    source && conversation
      ? durableDraftTarget(conversation.reviewIndex, {
          source,
          content: "",
          ...(part ? { part } : {}),
        })
      : undefined,
  );
  const authorName = $derived(
    conversation?.members.find((member) => member.id === source?.agentPubkey)
      ?.name ?? "Agent",
  );
  const reactions = $derived(
    durable && conversation
      ? transcriptReactions(
          conversation.reviewIndex,
          durable.anchor,
          conversation.memberId,
        ).groups
      : [],
  );
  const comments = $derived(
    conversation?.transcriptComments.filter(
      ({ target }) =>
        target.checkpoint.authorPubkey === source?.agentPubkey &&
        target.rootId === (durable?.rootId ?? source?.threadRootId) &&
        target.checkpoint.channelId ===
          (durable?.checkpoint.channelId ?? source?.channelId) &&
        [source, ...related].some(
          (item) =>
            item &&
            target.record.id === item.record.id &&
            (!item.checkpointEventId ||
              target.checkpoint.eventId === item.checkpointEventId),
        ) &&
        (part ? target.anchor.part === part : true),
    ) ?? [],
  );
  const focus = $derived(conversation?.replies.focus);
  const focused = $derived(
    !!focus &&
      !!durable &&
      focus.rootId === durable.rootId &&
      [source, ...related].some(
        (item) => item?.record.id === focus.anchor.recordId,
      ) &&
      focus.anchor.checkpointEventId === durable.checkpoint.eventId &&
      (part ? part === focus.anchor.part : true),
  );
  let error = $state("");
  let status = $state("");
  async function copy(value: string, message: string) {
    try {
      await navigator.clipboard.writeText(value);
      status = message;
      error = "";
    } catch {
      error = "Could not copy to the clipboard";
    }
  }
  async function react(
    emoji: string,
    custom?: { shortcode: string; url: string },
  ) {
    if (!durable || !conversation) return;
    try {
      await conversation.reactToTranscript(durable.anchor, emoji, custom);
      error = "";
    } catch (cause) {
      error =
        cause instanceof Error ? cause.message : "Could not save reaction";
    }
  }
  function copyLink() {
    if (!durable) return;
    const roomId = conversation?.rooms.find(
      (room) => (room.groupId ?? room.id) === durable.checkpoint.channelId,
    )?.id;
    if (roomId)
      void copy(
        buildCommunityMessageLink({
          roomId,
          eventId: durable.rootId,
          threadRootId: durable.rootId,
          checkpoint: durable.checkpoint.eventId,
          record: durable.record.id,
          ...(part ? { part } : {}),
        }),
        "Message link copied",
      );
  }
  function copyEvent() {
    const event =
      durable && conversation?.reviewIndex.byId.get(durable.checkpoint.eventId);
    if (event) void copy(formatCommunityEventCopy(text, event), "Event copied");
  }
</script>

{#if source && conversation}
  <div
    class="transcript-item"
    role="group"
    aria-label={label}
    tabindex="-1"
    data-ui-part="transcript-item"
    data-record-id={source.record.id}
    data-highlighted={focused ? "" : undefined}
    use:focusTranscriptItem={focused ? focus?.revision : undefined}
    {...hover.handlers}
  >
    {@render children()}
    <CommunityMessageActions
      id={source.key}
      {authorName}
      visible={hover.visible}
      onReply={() => conversation.replies.select(source, text, part)}
      onCopyMessage={() => void copy(text, "Message copied")}
      onCopyLink={copyLink}
      onCopyEvent={copyEvent}
      {...conversation.memberId
        ? { onAddReaction: (_id, emoji, custom) => react(emoji, custom) }
        : {}}
      disabledReason={durable
        ? undefined
        : "Waiting for this record to be saved. You can copy text or draft a reply."}
    />
    {#if reactions.length}<CommunityReactions
        mode="bar"
        {reactions}
        label={`Reactions to ${label}`}
        onToggle={(emoji) => react(emoji)}
      />{/if}
    {#if comments.length}<CommunityChip
        variant="muted"
        size="compact"
        onclick={() => conversation.replies.revealComment(comments[0]!.event)}
      >
        {comments.length}
        {comments.length === 1 ? "reply" : "replies"}
      </CommunityChip>{/if}
    {#if error}<p role="alert">{error}</p>{/if}
    {#if status}<span class="sr-only" role="status">{status}</span>{/if}
  </div>
{:else}{@render children()}{/if}

<style>
  .transcript-item {
    position: relative;
    min-width: 0;
    border-radius: var(--radius);
  }
  .transcript-item[data-highlighted] {
    background: color-mix(in srgb, var(--primary) 12%, var(--background));
  }
  .transcript-item:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>
