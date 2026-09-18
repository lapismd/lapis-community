<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn } from "storybook/test";

  import type { PullRequestState } from "../../projects/index.js";
  import type { CommunityMemberModel } from "../community-workspace/model.js";
  import CommunityProjectsPullRequestConversation from "./CommunityProjectsPullRequestConversation.svelte";

  const pullRequest = {
    root: { id: "a".repeat(64), pubkey: "author", kind: 1618, created_at: 1, content: "", tags: [], sig: "" },
    repository: { kind: 30617, owner: "o", identifier: "notes", coordinate: "30617:o:notes" },
    title: "Protect main",
    content: "",
    labels: [],
    recipients: [],
    reviewers: [],
    initialCommit: "b".repeat(40),
    currentCommit: "b".repeat(40),
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
  } as PullRequestState;

  const members: CommunityMemberModel[] = [
    {
      id: "maint",
      name: "Maintainer",
      handle: "maint",
      initials: "MA",
      roles: ["maintainer"],
    },
  ];

  const { Story } = defineMeta({
    title: "Community/Projects/Pull request conversation",
    component: CommunityProjectsPullRequestConversation,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Non-maintainer hides review and merge"
  args={{
    pullRequest,
    canCollaborate: true,
    canMerge: false,
    canSubmit: false,
    canComment: true,
    members,
    memberForPubkey: () => members[0]!,
    commentMessage: () => ({
      id: "c",
      roomId: "dev",
      authorId: "author",
      createdAt: "2026-01-01T00:00:00.000Z",
      content: "",
    }),
    canReact: () => false,
    reactionOptions: () => [],
    onToggleReaction: fn(),
    onMerge: fn(),
    onSubmitReview: fn(),
    onRequestReview: fn(),
    onUpdateLifecycle: fn(),
    onSubmitComment: fn(),
  }}
  play={async ({ canvas }) => {
    await expect(
      canvas.queryByRole("button", { name: /merge/iu }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole("button", { name: "Submit review" }),
    ).not.toBeInTheDocument();
  }}
>
  {#snippet template(args)}
    <CommunityProjectsPullRequestConversation {...args} />
  {/snippet}
</Story>

<Story
  name="Maintainer can request review"
  args={{
    pullRequest,
    canCollaborate: true,
    canMerge: true,
    canSubmit: true,
    members,
    memberForPubkey: () => members[0]!,
    commentMessage: () => ({
      id: "c",
      roomId: "dev",
      authorId: "author",
      createdAt: "2026-01-01T00:00:00.000Z",
      content: "",
    }),
    canReact: () => false,
    reactionOptions: () => [],
    onToggleReaction: fn(),
    onMerge: fn(),
    onSubmitReview: fn(),
    onRequestReview: fn(),
    onUpdateLifecycle: fn(),
    onSubmitComment: fn(),
  }}
  play={async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", { name: "Merge pull request" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Submit review" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("combobox", {
        name: "Request review from a maintainer",
      }),
    ).toBeVisible();
  }}
>
  {#snippet template(args)}
    <CommunityProjectsPullRequestConversation {...args} />
  {/snippet}
</Story>
