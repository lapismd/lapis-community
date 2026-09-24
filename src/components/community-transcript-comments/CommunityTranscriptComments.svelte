<script lang="ts">
  import { selectTranscriptPassage } from "../../projects/transcript-record-parts.js";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as Select from "@lapismd/design-core/shadcn/select";
  import { DialogFrame } from "@lapismd/design-core/forms/dialog";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import CommunityChatComposer from "../community-chat-composer/CommunityChatComposer.svelte";
  import CommunityCommitDiscussion from "../community-commit-discussion/CommunityCommitDiscussion.svelte";
  import { useAgentConversation } from "../community-agent-conversation/context.svelte.js";
  import {
    durableDraftTarget,
    type TranscriptCommentDraft,
  } from "../community-agent-conversation/transcript-comment-draft.js";
  import { createTranscriptComment } from "../../projects/transcript-comments.js";
  import type { TranscriptCommentPart } from "../../protocol/transcript-comment-anchor.js";
  import {
    transcriptCommentLabel,
    type TranscriptCommentSource,
  } from "../community-agent-conversation/transcript-comment-sources.js";
  let { source }: { source: TranscriptCommentSource } = $props();
  const conversation = useAgentConversation();
  let open = $state(false),
    busy = $state(false),
    error = $state("");
  let excerpt = $state<HTMLPreElement>();
  const draft = $derived(
    conversation?.transcriptDrafts.get(source.key) ?? { source, content: "" },
  );
  const target = $derived(
    open
      ? durableDraftTarget(conversation?.reviewIndex ?? [], draft)
      : undefined,
  );
  const label = $derived(transcriptCommentLabel(source));
  const comments = $derived(
    (conversation?.transcriptComments ?? [])
      .filter(
        ({ target }) =>
          target.record.id === source.record.id &&
          target.checkpoint.authorPubkey === source.agentPubkey &&
          (!source.channelId ||
            target.checkpoint.channelId === source.channelId) &&
          (!source.threadRootId || target.rootId === source.threadRootId) &&
          (!source.checkpointEventId ||
            target.checkpoint.eventId === source.checkpointEventId),
      )
      .map(({ event }) => event),
  );
  function update(patch: Partial<TranscriptCommentDraft>) {
    conversation?.transcriptDrafts.save(source.key, { ...draft, ...patch });
  }
  function selectPart(value: string) {
    const { part: _part, selection: _selection, ...rest } = draft;
    conversation?.transcriptDrafts.save(source.key, {
      ...rest,
      ...(value === "record" ? {} : { part: value as TranscriptCommentPart }),
    });
  }
  function selectText() {
    const selection = excerpt?.ownerDocument.getSelection();
    if (!excerpt || !draft.part || !selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (
      !excerpt.contains(range.startContainer) ||
      !excerpt.contains(range.endContainer)
    )
      return;
    const prefix = range.cloneRange();
    prefix.selectNodeContents(excerpt);
    prefix.setEnd(range.startContainer, range.startOffset);
    const start = prefix.toString().length;
    const quote = selectTranscriptPassage(
      draft.source.parts[draft.part]!,
      start,
      start + range.toString().length,
    );
    if (quote) update({ selection: quote });
  }
  async function submit(content: string) {
    if (!conversation || busy || !content.trim()) return;
    busy = true;
    error = "";
    update({ content });
    try {
      const current = durableDraftTarget(conversation.reviewIndex, draft);
      if (!current)
        throw new Error(
          "The matching record is not saved yet. Your draft is retained.",
        );
      await conversation.publish(
        createTranscriptComment(conversation.events, current.anchor, content),
      );
      conversation.transcriptDrafts.remove(source.key);
      open = false;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
      throw cause;
    } finally {
      busy = false;
    }
  }
  const partLabel = (part: string) =>
    part.startsWith("plan:")
      ? `Plan step ${Number(part.slice(5)) + 1}`
      : ({
          text: "Text",
          input: "Tool input",
          output: "Tool output",
          error: "Tool error",
        }[part] ?? part);
</script>

{#if conversation}
  <div data-ui-component="community-transcript-comments">
    {#if conversation.memberId}<Button
        size="sm"
        variant="ghost"
        onclick={() => {
          error = "";
          open = true;
        }}>Comment on {label}</Button
      >{/if}
    <CommunityCommitDiscussion {comments} />
  </div>
  <Dialog.Root bind:open
    ><DialogFrame title={`Comment on ${label}`} size="form">
      <Select.Root
        type="single"
        value={draft.part ?? "record"}
        onValueChange={selectPart}
      >
        <Select.Trigger aria-label="Comment target"
          >{draft.part ? partLabel(draft.part) : "Whole record"}</Select.Trigger
        >
        <Select.Content
          ><Select.Group
            ><Select.Item value="record">Whole record</Select.Item>
            {#each Object.keys(draft.source.parts) as part (part)}<Select.Item
                value={part}>{partLabel(part)}</Select.Item
              >{/each}
          </Select.Group></Select.Content
        >
      </Select.Root>
      {#if draft.part}
        <p>Select a passage below to attach a quote.</p>
        <pre bind:this={excerpt} aria-label="Transcript excerpt">{draft.source
            .parts[draft.part]}</pre>
        <Button
          variant="outline"
          size="sm"
          onpointerdown={selectText}
          onclick={selectText}>Use selected text</Button
        >
      {/if}
      {#if draft.selection}<blockquote>{draft.selection.exact}</blockquote>{/if}
      <CommunityChatComposer
        mode="form"
        bind:value={() => draft.content, (content) => update({ content })}
        ariaLabel="Comment"
        disabled={busy}
        onSubmit={(submission) => submit(submission.content)}
      />
      {#if !target}<p role="status">
          Waiting for this record to be saved.
        </p>{/if}
      <p>
        Comments are included when you next mention the agent or choose
        Continue.
      </p>
      {#if error}<p role="alert">{error}</p>{/if}
      {#snippet footer()}<Button
          disabled={busy || !target || !draft.content.trim()}
          onclick={() => submit(draft.content).catch(() => {})}
          >Post comment</Button
        >{/snippet}
    </DialogFrame></Dialog.Root
  >
{/if}

<style>
  pre {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    max-height: 12rem;
    overflow: auto;
  }
</style>
