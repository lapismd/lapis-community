<script lang="ts">
  import { agentContextMessageRole } from "../../projects/repository-agent-context.js";

  import { untrack, type ComponentProps } from "svelte";
  import {
    FileDiff,
    FileDiffComposer,
    type FileDiffLineContext,
  } from "@lapismd/design-core/diff";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import MessageSquarePlusIcon from "@lucide/svelte/icons/message-square-plus";
  import CommunityChatComposer from "../community-chat-composer/CommunityChatComposer.svelte";
  import CommunityCommitDiscussion from "../community-commit-discussion/CommunityCommitDiscussion.svelte";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import { useAgentConversation } from "../community-agent-conversation/context.svelte.js";
  import { eventRoot } from "../community-agent-conversation/model.js";
  import {
    commitComments,
    createCommitComment,
    type CommitCommentAnchor,
  } from "../../projects/commit-comments.js";
  import type { RepositoryAgentCheckpoint } from "../../projects/repository-agent-context.js";
  let {
    checkpoints = [],
    commitId,
    base,
    single = false,
    wrap = false,
    ...diff
  }: ComponentProps<typeof FileDiffComposer> & {
    checkpoints?: readonly RepositoryAgentCheckpoint[];
    commitId?: string | undefined;
    base?: string | undefined;
    single?: boolean;
    wrap?: boolean;
  } = $props();
  const conversation = useAgentConversation();
  const linked = $derived(
    [...checkpoints, ...(conversation?.checkpoints ?? [])].filter(
      (checkpoint) =>
        commitId && checkpoint.commitIds.includes(commitId) && !checkpoint.live,
    ),
  );
  const checkpoint = $derived(
    linked.toSorted((a, b) => b.createdAt - a.createdAt)[0],
  );
  const channelId = $derived(checkpoint?.channelId);
  $effect(() => {
    const id = channelId;
    if (id && conversation) return untrack(() => conversation.watch(id));
  });
  const comments = $derived(
    commitComments(
      conversation?.events ?? [],
      linked.map((item) => item.eventId),
      commitId ?? "",
    ),
  );
  let anchor = $state<CommitCommentAnchor>();
  let composing = $state(false);
  let draft = $state("");
  let error = $state("");
  let busy = $state(false);
  $effect(() => {
    void commitId;
    anchor = undefined;
    composing = false;
    draft = "";
    error = "";
  });
  function lineAnchor(context: FileDiffLineContext): CommitCommentAnchor {
    return {
      path: context.path,
      side: context.variant === "removed" ? "old" : "new",
      line: context.lineNumber!,
    };
  }
  function matches(context: FileDiffLineContext) {
    const value = lineAnchor(context);
    return (
      anchor?.path === value.path &&
      anchor.side === value.side &&
      anchor.line === value.line
    );
  }
  async function submit(content: string) {
    if (!checkpoint || !commitId || !conversation) return;
    busy = true;
    try {
      const requestId = checkpoint.records.find(
        (record) => agentContextMessageRole(record) === "user",
      )?.sourceEventId;
      const source = requestId
        ? conversation.message(requestId)?.sourceEvent
        : undefined;
      if (!source)
        throw new Error(
          "The original request is still loading. Try again shortly.",
        );
      await conversation.publish(
        createCommitComment(checkpoint, commitId, eventRoot(source), content, {
          ...(anchor ? { anchor } : {}),
          ...(base ? { base } : {}),
        }),
      );
      draft = "";
      anchor = undefined;
      composing = false;
      error = "";
    } catch (cause) {
      error = String(cause);
    } finally {
      busy = false;
    }
  }
</script>

{#snippet lineComment(context: FileDiffLineContext)}
  {#if checkpoint && context.lineNumber !== null && conversation?.memberId}
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={`Comment on ${context.path} line ${context.lineNumber}`}
      title="Add inline comment"
      onclick={() => {
        anchor = lineAnchor(context);
        composing = true;
        draft = "";
      }}><MessageSquarePlusIcon aria-hidden="true" /></Button
    >
  {/if}
{/snippet}
{#snippet inlineDiscussion(context: FileDiffLineContext)}
  {@const entries =
    context.lineNumber === null
      ? []
      : commitComments(
          comments,
          linked.map((item) => item.eventId),
          commitId ?? "",
          lineAnchor(context),
        )}
  {#if entries.length || (composing && matches(context))}
    <div
      class="commit-diff__discussion"
      aria-label={`Discussion on ${context.path} line ${context.lineNumber}`}
    >
      <CommunityCommitDiscussion comments={entries} />
      {#if composing && matches(context)}{@render composer()}{/if}
    </div>
  {/if}
{/snippet}
{#snippet composer()}
  <CommunityChatComposer
    mode="form"
    showSubmitButton
    bind:value={draft}
    ariaLabel="Commit review comment"
    submitLabel="Comment"
    disabled={busy}
    onSubmit={(submission) => submit(submission.content)}
  />
  <Button
    variant="ghost"
    onclick={() => {
      composing = false;
      anchor = undefined;
    }}>Cancel</Button
  >
  <p class="commit-diff__hint">Included in the agent’s next turn.</p>
{/snippet}
{#if checkpoint}
  <div class="commit-diff__actions">
    <Button
      variant="ghost"
      size="sm"
      disabled={!conversation?.memberId}
      onclick={() => {
        anchor = undefined;
        composing = true;
      }}><MessageSquarePlusIcon aria-hidden="true" />Comment on commit</Button
    >
    <CommunityChip size="compact">{comments.length} comments</CommunityChip>
  </div>
  <CommunityCommitDiscussion
    comments={comments.filter(
      (comment) => !comment.tags.some(([key]) => key === "file"),
    )}
  />
  {#if composing && !anchor}{@render composer()}{/if}
{/if}
{#if error}<p role="alert">{error}</p>{/if}
{#if single && diff.files?.[0]}
  <FileDiff
    path={diff.files[0].path}
    patch={diff.files[0].patch ?? ""}
    viewMode={diff.viewMode ?? "unified"}
    {wrap}
    lineAccessory={lineComment}
    lineAnnotation={inlineDiscussion}
  />
{:else}
  <FileDiffComposer
    {...diff}
    lineAccessory={lineComment}
    lineAnnotation={inlineDiscussion}
  />
{/if}

<style>
  .commit-diff__discussion {
    padding: 0.75rem;
    background: var(--background);
    border-block: 1px solid var(--border);
  }
  .commit-diff__actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .commit-diff__hint {
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
  }
</style>
