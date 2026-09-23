<script lang="ts">
  import { fn } from "storybook/test";

  import type { FileDiffLineContext } from "@lapismd/design-core/diff";
  import type { PullRequestState } from "../../projects/index.js";
  import type { CommunityMemberModel } from "../community-workspace/model.js";
  import CommunityProjectsPullRequestConversation from "./CommunityProjectsPullRequestConversation.svelte";
  import CommunityProjectsPullRequestInlineThread from "./CommunityProjectsPullRequestInlineThread.svelte";
  import CommunityProjectsTaskCommentComposer from "./CommunityProjectsTaskCommentComposer.svelte";
  import { provideReviewComposerDraftScope } from "./review-composer-draft-scope.js";

  let {
    surface,
  }: {
    surface: "task" | "pull-request" | "pull-request-inline";
  } = $props();

  const member: CommunityMemberModel = {
    id: "story-review-member",
    name: "Ada",
    handle: "ada",
    initials: "AL",
  };
  const pullRequestId = $derived(`story-lc-ui-052-${surface}`.padEnd(64, "0"));
  const pullRequest = $derived<PullRequestState>({
    root: {
      id: pullRequestId,
      pubkey: "author",
      kind: 1618,
      created_at: 1,
      content: "",
      tags: [],
      sig: "",
    },
    repository: {
      kind: 30617,
      owner: "o",
      identifier: "notes",
      coordinate: "30617:o:notes",
    },
    title: "Protect main",
    content: "",
    labels: [],
    recipients: [],
    reviewers: [],
    initialCommit: "b".repeat(40),
    currentCommit: "b".repeat(40),
    mergeBase: "a".repeat(40),
    mergeCommit: "",
    mergeReferences: [],
    cloneUrls: [],
    branchName: "feature",
    targetBranch: "main",
    lifecycle: "open",
    approvals: [],
    changeRequests: [],
    updates: [],
    comments: [],
    lifecycleEvents: [],
    createdAt: 1,
    updatedAt: 1,
  });
  const context: FileDiffLineContext = {
    path: "src/app.ts",
    lineNumber: 12,
    variant: "added",
    text: "return true;",
  };

  provideReviewComposerDraftScope(() => ({
    pullRequestId: pullRequest.root.id,
    viewer: member.id,
    communityId: "story:lc-ui-052",
  }));

  let comment = $state("");
</script>

{#if surface === "task"}
  <CommunityProjectsTaskCommentComposer
    bind:value={comment}
    taskId="story-lc-ui-052-task"
    viewer={member.id}
    communityId="story:lc-ui-052"
    members={[member]}
    canCollaborate
    onSubmit={fn(async () => {})}
  />
{:else if surface === "pull-request"}
  <CommunityProjectsPullRequestConversation
    bind:comment
    {pullRequest}
    canCollaborate
    canComment
    members={[member]}
    currentMemberId={member.id}
    memberForPubkey={() => member}
    commentMessage={() => ({
      id: "c",
      authorId: "author",
      timestamp: "now",
      content: "",
    })}
    canReact={() => false}
    reactionOptions={() => []}
    onToggleReaction={fn()}
    onMerge={fn()}
    onSubmitReview={fn()}
    onUpdateLifecycle={fn()}
    onSubmitComment={fn()}
  />
{:else}
  <CommunityProjectsPullRequestInlineThread
    {context}
    comments={[]}
    showComposer
    bind:composerContent={comment}
    canCollaborate
    members={[member]}
    currentMemberId={member.id}
    memberForPubkey={() => member}
    commentMessage={() => ({
      id: "c",
      authorId: "author",
      timestamp: "now",
      content: "",
    })}
    canReact={() => false}
    reactionOptions={() => []}
    onToggleReaction={fn()}
    onCancelComposer={fn()}
    onSubmitComposer={fn()}
    linePrefix="+"
  />
{/if}
