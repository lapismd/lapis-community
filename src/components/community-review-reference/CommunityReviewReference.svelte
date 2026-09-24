<script lang="ts">
  import { createCommitDescription } from "./commit-description.svelte.js";
  import { resolveTranscriptComment } from "../../projects/transcript-comments.js";
  import { transcriptReviewPreview } from "./transcript-review-preview.js";
  import * as Tooltip from "@lapismd/design-core/shadcn/tooltip";
  import GitCommitHorizontalIcon from "@lucide/svelte/icons/git-commit-horizontal";
  import CommunityReplyPreview from "../community-reply-preview/CommunityReplyPreview.svelte";
  import MessageSquareIcon from "@lucide/svelte/icons/message-square";
  import type { NostrEvent } from "../../protocol/index.js";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import { useAgentConversation } from "../community-agent-conversation/context.svelte.js";
  import { eventTag } from "../community-agent-conversation/model.js";
  import { projectRouteToHash } from "../community-application/project-route.js";
  let {
    comment,
    description,
  }: { comment: NostrEvent; description?: string | undefined } = $props();
  const conversation = useAgentConversation();
  const repository = $derived(eventTag(comment, "a"));
  const commit = $derived(eventTag(comment, "c"));
  const file = $derived(eventTag(comment, "file"));
  const line = $derived(eventTag(comment, "line"));
  const fetched = createCommitDescription(() => ({
    repository,
    commit,
    file,
    line,
    description,
    conversation,
  }));
  const transcript = $derived(
    resolveTranscriptComment(comment, conversation?.reviewIndex ?? []),
  );
  const preview = $derived(
    transcriptReviewPreview(comment, transcript, conversation),
  );
</script>

{#if preview}
  <CommunityReplyPreview target={preview.target} onOpen={preview.open} />
  {#if transcript?.anchor.selection}<blockquote>
      {transcript.anchor.selection.exact}
    </blockquote>{/if}
{:else if repository && commit}
  <Tooltip.Provider
    ><Tooltip.Root>
      <Tooltip.Trigger>
        {#snippet child({ props })}
          <CommunityChip
            variant="muted"
            shape="square"
            size="default"
            href={projectRouteToHash({
              kind: "repository",
              coordinate: repository,
              surface: "commits",
              commitSha: commit,
            })}
            linkProps={{ ...props }}
            class="review-reference"
            ariaLabel={file
              ? `Comment on ${fetched.details}`
              : `Commit: ${fetched.value.split("\n")[0]}`}
          >
            {#snippet leading()}{#if file}<MessageSquareIcon
                  aria-hidden="true"
                />{:else}<GitCommitHorizontalIcon
                  aria-hidden="true"
                />{/if}{/snippet}
            <span class="review-reference__label">{fetched.label}</span>
          </CommunityChip>
        {/snippet}
      </Tooltip.Trigger>
      <Tooltip.Content
        ><span class="review-reference__description">{fetched.details}</span
        ></Tooltip.Content
      >
    </Tooltip.Root></Tooltip.Provider
  >
{/if}

<style>
  :global(.review-reference) {
    max-width: 100%;
    min-width: 0;
  }
  .review-reference__label {
    max-width: 28ch;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .review-reference__description {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
