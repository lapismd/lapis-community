<script lang="ts">
  import type {
    FileDiffFileScrollTarget,
    FileDiffLineContext,
    FileDiffViewMode,
    FileListingViewMode,
  } from "@lapismd/design-core/diff";
  import * as Collapsible from "@lapismd/design-core/shadcn/collapsible";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";

  import type { CommunityCustomEmoji } from "../../community/index.js";
  import type {
    ProjectForgePullRequestDiff,
    PullRequestComment,
  } from "../../projects/index.js";
  import CommunitySkeleton from "../community-skeleton/CommunitySkeleton.svelte";
  import type {
    CommunityMemberModel,
    CommunityMessageModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";
  import type { CommunityProjectsDiffFile } from "./model.js";
  import CommunityProjectsPullRequestDiffWorkbench from "./CommunityProjectsPullRequestDiffWorkbench.svelte";
  import CommunityProjectsSourceError from "./CommunityProjectsSourceError.svelte";

  let {
    open = $bindable(false),
    fileListOpen = $bindable(true),
    fileFilter = $bindable(""),
    fileListMode = $bindable("tree" as FileListingViewMode),
    selectedPath = $bindable(""),
    collapsedPaths = $bindable<string[]>([]),
    viewedPaths = $bindable<string[]>([]),
    viewMode = $bindable("unified" as FileDiffViewMode),
    scrollTarget = $bindable<FileDiffFileScrollTarget | null>(null),
    inlineContent = $bindable(""),
    loading = false,
    diff,
    diffError = "",
    visibleFiles,
    viewedCount,
    busy = false,
    canCollaborate = false,
    members = [],
    rooms = [],
    communityEmojis = [],
    currentMemberId,
    homeChannelId,
    homeChannelName,
    inlineComments,
    showComposer,
    memberForPubkey,
    commentMessage,
    canReact,
    reactionOptions,
    onSelectChannel,
    onSelectPath,
    onToggleFile,
    onViewedChange,
    onViewModeChange,
    onAddLineComment,
    onToggleReaction,
    onCancelComposer,
    onSubmitComposer,
  }: {
    open?: boolean | undefined;
    fileListOpen?: boolean | undefined;
    fileFilter?: string | undefined;
    fileListMode?: FileListingViewMode | undefined;
    selectedPath?: string | undefined;
    collapsedPaths?: string[] | undefined;
    viewedPaths?: string[] | undefined;
    viewMode?: FileDiffViewMode | undefined;
    scrollTarget?: FileDiffFileScrollTarget | null | undefined;
    inlineContent?: string | undefined;
    loading?: boolean | undefined;
    diff?: ProjectForgePullRequestDiff | undefined;
    diffError?: string | undefined;
    visibleFiles: readonly CommunityProjectsDiffFile[];
    viewedCount: number;
    busy?: boolean | undefined;
    canCollaborate?: boolean | undefined;
    members?: readonly CommunityMemberModel[] | undefined;
    rooms?: readonly CommunityRoomModel[] | undefined;
    communityEmojis?: readonly CommunityCustomEmoji[] | undefined;
    currentMemberId?: string | undefined;
    homeChannelId?: string | undefined;
    homeChannelName?: string | undefined;
    inlineComments: (
      context: FileDiffLineContext,
    ) => readonly PullRequestComment[];
    showComposer: (context: FileDiffLineContext) => boolean;
    memberForPubkey: (pubkey: string) => CommunityMemberModel;
    commentMessage: (comment: PullRequestComment) => CommunityMessageModel;
    canReact: (comment: PullRequestComment) => boolean;
    reactionOptions: (
      comment: PullRequestComment,
    ) => readonly string[] | undefined;
    onSelectChannel?: ((roomId: string) => void) | undefined;
    onSelectPath: (path: string) => void;
    onToggleFile: (path: string, collapsed: boolean) => void;
    onViewedChange: (path: string, viewed: boolean) => void;
    onViewModeChange: (value: string | undefined) => void;
    onAddLineComment: (context: FileDiffLineContext) => void;
    onToggleReaction: (comment: PullRequestComment, emoji: string) => void;
    onCancelComposer: () => void;
    onSubmitComposer: (content: string) => void;
  } = $props();
</script>

<Collapsible.Root
  class="community-projects__review-section community-projects__review-section--files"
  bind:open
>
  <Collapsible.Trigger
    class="community-projects__review-section-trigger community-projects__review-section-trigger--files"
  >
    <span>Files changed</span>
    {#if open}
      <ChevronDownIcon aria-hidden="true" />
      {#if diff}<span class="community-projects__review-section-count"
          >{diff.files.length}</span
        >{/if}
    {:else}
      <ChevronRightIcon aria-hidden="true" />
    {/if}
  </Collapsible.Trigger>
  <Collapsible.Content class="community-projects__review-files-content">
    {#if loading && !diff}
      <CommunitySkeleton layout="repository" label="Loading repository diff" />
    {:else if diffError}
      <CommunityProjectsSourceError
        message={diffError}
        {homeChannelId}
        {homeChannelName}
        {rooms}
        {onSelectChannel}
      />
    {:else if diff}
      <CommunityProjectsPullRequestDiffWorkbench
        bind:fileListOpen
        bind:fileFilter
        bind:fileListMode
        bind:selectedPath
        bind:collapsedPaths
        bind:viewedPaths
        bind:viewMode
        bind:scrollTarget
        bind:inlineContent
        {diff}
        {visibleFiles}
        {viewedCount}
        {busy}
        {canCollaborate}
        {members}
        {rooms}
        {communityEmojis}
        {currentMemberId}
        {inlineComments}
        {showComposer}
        {memberForPubkey}
        {commentMessage}
        {canReact}
        {reactionOptions}
        {onSelectPath}
        {onToggleFile}
        {onViewedChange}
        {onViewModeChange}
        {onAddLineComment}
        {onToggleReaction}
        {onCancelComposer}
        {onSubmitComposer}
      />
    {:else}
      <p class="community-projects__status">
        This comparison is unavailable through the relay. Community does not
        assume local Git access.
      </p>
    {/if}
  </Collapsible.Content>
</Collapsible.Root>
