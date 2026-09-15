<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import type { Snippet } from "svelte";
  import type { ComponentProps } from "svelte";

  import type { PullRequestState } from "../../projects/index.js";
  import CommunityRelativeTime from "../community-relative-time/CommunityRelativeTime.svelte";
  import CommunityProjectsPullRequestDetail from "./CommunityProjectsPullRequestDetail.svelte";
  import CommunityProjectsPullRequestList from "./CommunityProjectsPullRequestList.svelte";

  type DetailProps = ComponentProps<typeof CommunityProjectsPullRequestDetail>;
  type ListProps = ComponentProps<typeof CommunityProjectsPullRequestList>;

  let {
    pullRequest,
    listHeader,
    pullRequests = [],
    listLayout = "list",
    groupOpen = $bindable({
      open: true,
      draft: true,
      merged: true,
      closed: true,
    }),
    onSelectPullRequest,
    projectFilter,
    showHeader = true,
    onClose,
    descriptionOpen = $bindable(true),
    filesOpen = $bindable(false),
    commitsOpen = $bindable(false),
    checksOpen = $bindable(false),
    activityOpen = $bindable(true),
    fileListOpen = $bindable(true),
    fileFilter = $bindable(""),
    fileListMode = $bindable("tree"),
    selectedPath = $bindable(""),
    collapsedPaths = $bindable([]),
    viewedPaths = $bindable([]),
    viewMode = $bindable("unified"),
    scrollTarget = $bindable(null),
    inlineContent = $bindable(""),
    comment = $bindable(""),
    ...detail
  }: {
    pullRequest?: PullRequestState | undefined;
    listHeader?: Snippet | undefined;
    showHeader?: boolean | undefined;
    onClose?: (() => void) | undefined;
  } & Omit<DetailProps, "pullRequest" | "showHeader" | "onClose"> &
    Pick<
      ListProps,
      | "pullRequests"
      | "listLayout"
      | "groupOpen"
      | "onSelectPullRequest"
      | "projectFilter"
    > = $props();
</script>

{#if pullRequest}
  {#if showHeader}
    <header class="community-projects__review-header">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        class="community-projects__review-back"
        aria-label="Back to reviews"
        title="Back to reviews"
        onclick={onClose}
      >
        <ArrowLeftIcon aria-hidden="true" />
      </Button>
      <div>
        <div class="community-projects__review-title">
          <h2 id="community-project-review-title">
            {pullRequest.title}
            <span>#{pullRequest.root.id.slice(0, 8)}</span>
          </h2>
        </div>
        <p>
          Review opened <CommunityRelativeTime
            timestamp={pullRequest.createdAt}
          />
        </p>
      </div>
    </header>
  {/if}
  <CommunityProjectsPullRequestDetail
    {pullRequest}
    {showHeader}
    {onClose}
    bind:descriptionOpen
    bind:filesOpen
    bind:commitsOpen
    bind:checksOpen
    bind:activityOpen
    bind:fileListOpen
    bind:fileFilter
    bind:fileListMode
    bind:selectedPath
    bind:collapsedPaths
    bind:viewedPaths
    bind:viewMode
    bind:scrollTarget
    bind:inlineContent
    bind:comment
    {...detail}
  />
{:else}
  {@render listHeader?.()}
  <CommunityProjectsPullRequestList
    {pullRequests}
    {listLayout}
    bind:groupOpen
    memberForPubkey={detail.memberForPubkey}
    onOpenProfile={detail.onOpenProfile}
    onMessageMember={detail.onMessageMember}
    onWaveMember={detail.onWaveMember}
    {onSelectPullRequest}
    {projectFilter}
  />
{/if}
