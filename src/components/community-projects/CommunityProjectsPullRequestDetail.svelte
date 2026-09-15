<script lang="ts">
  import type {
    FileDiffFileScrollTarget,
    FileDiffLineContext,
    FileDiffViewMode,
    FileListingViewMode,
  } from "@lapismd/design-core/diff";

  import type { CommunityCustomEmoji } from "../../community/index.js";
  import type {
    ProjectForgeCommit,
    ProjectForgePullRequestDiff,
    PullRequestComment,
    PullRequestState,
  } from "../../projects/index.js";
  import type {
    CommunityMemberModel,
    CommunityMessageModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";
  import type { CommunityProjectsDiffFile } from "./model.js";
  import CommunityProjectsPullRequestCommits from "./CommunityProjectsPullRequestCommits.svelte";
  import CommunityProjectsPullRequestConversation from "./CommunityProjectsPullRequestConversation.svelte";
  import CommunityProjectsPullRequestFiles from "./CommunityProjectsPullRequestFiles.svelte";
  import CommunityProjectsPullRequestMeta from "./CommunityProjectsPullRequestMeta.svelte";

  let {
    pullRequest,
    showHeader = true,
    descriptionOpen = $bindable(true),
    filesOpen = $bindable(false),
    commitsOpen = $bindable(false),
    checksOpen = $bindable(false),
    activityOpen = $bindable(true),
    fileListOpen = $bindable(true),
    fileFilter = $bindable(""),
    fileListMode = $bindable("tree" as FileListingViewMode),
    selectedPath = $bindable(""),
    collapsedPaths = $bindable<string[]>([]),
    viewedPaths = $bindable<string[]>([]),
    viewMode = $bindable("unified" as FileDiffViewMode),
    scrollTarget = $bindable<FileDiffFileScrollTarget | null>(null),
    inlineContent = $bindable(""),
    comment = $bindable(""),
    loading = false,
    diff,
    diffError = "",
    visibleFiles,
    viewedCount,
    busy = false,
    canCollaborate = false,
    canMerge = false,
    mergeError = "",
    mergeStatus = "",
    canSubmit = false,
    canComment = false,
    canUpdateLifecycle = false,
    members = [],
    rooms = [],
    communityEmojis = [],
    currentMemberId,
    homeChannelId,
    homeChannelName,
    memberForPubkey,
    commentMessage,
    canReact,
    reactionOptions,
    inlineComments,
    showComposer,
    onOpenProfile,
    onMessageMember,
    onWaveMember,
    onClose,
    onCopyCommit,
    onSelectCommit,
    commitSummary,
    onSelectChannel,
    onSelectPath,
    onToggleFile,
    onViewedChange,
    onViewModeChange,
    onAddLineComment,
    onToggleReaction,
    onCancelComposer,
    onSubmitComposer,
    onMerge,
    onSubmitReview,
    onUpdateLifecycle,
    onSubmitComment,
  }: {
    pullRequest: PullRequestState;
    showHeader?: boolean | undefined;
    descriptionOpen?: boolean | undefined;
    filesOpen?: boolean | undefined;
    commitsOpen?: boolean | undefined;
    checksOpen?: boolean | undefined;
    activityOpen?: boolean | undefined;
    fileListOpen?: boolean | undefined;
    fileFilter?: string | undefined;
    fileListMode?: FileListingViewMode | undefined;
    selectedPath?: string | undefined;
    collapsedPaths?: string[] | undefined;
    viewedPaths?: string[] | undefined;
    viewMode?: FileDiffViewMode | undefined;
    scrollTarget?: FileDiffFileScrollTarget | null | undefined;
    inlineContent?: string | undefined;
    comment?: string | undefined;
    loading?: boolean | undefined;
    diff?: ProjectForgePullRequestDiff | undefined;
    diffError?: string | undefined;
    visibleFiles: readonly CommunityProjectsDiffFile[];
    viewedCount: number;
    busy?: boolean | undefined;
    canCollaborate?: boolean | undefined;
    canMerge?: boolean | undefined;
    mergeError?: string | undefined;
    mergeStatus?: string | undefined;
    canSubmit?: boolean | undefined;
    canComment?: boolean | undefined;
    canUpdateLifecycle?: boolean | undefined;
    members?: readonly CommunityMemberModel[] | undefined;
    rooms?: readonly CommunityRoomModel[] | undefined;
    communityEmojis?: readonly CommunityCustomEmoji[] | undefined;
    currentMemberId?: string | undefined;
    homeChannelId?: string | undefined;
    homeChannelName?: string | undefined;
    memberForPubkey: (pubkey: string) => CommunityMemberModel;
    commentMessage: (comment: PullRequestComment) => CommunityMessageModel;
    canReact: (comment: PullRequestComment) => boolean;
    reactionOptions: (
      comment: PullRequestComment,
    ) => readonly string[] | undefined;
    inlineComments: (
      context: FileDiffLineContext,
    ) => readonly PullRequestComment[];
    showComposer: (context: FileDiffLineContext) => boolean;
    onOpenProfile?: ((member: CommunityMemberModel) => void) | undefined;
    onMessageMember?: ((member: CommunityMemberModel) => void | Promise<void>) | undefined;
    onWaveMember?: ((member: CommunityMemberModel) => void | Promise<void>) | undefined;
    onClose?: (() => void) | undefined;
    onCopyCommit: (hash: string) => void;
    onSelectCommit?: ((commit: ProjectForgeCommit) => void) | undefined;
    commitSummary: (
      sha: string,
      subject: string,
      body: string,
      createdAt: number,
      authorId: string,
    ) => ProjectForgeCommit;
    onSelectChannel?: ((roomId: string) => void) | undefined;
    onSelectPath: (path: string) => void;
    onToggleFile: (path: string, collapsed: boolean) => void;
    onViewedChange: (path: string, viewed: boolean) => void;
    onViewModeChange: (value: string | undefined) => void;
    onAddLineComment: (context: FileDiffLineContext) => void;
    onToggleReaction: (comment: PullRequestComment, emoji: string) => void;
    onCancelComposer: () => void;
    onSubmitComposer: (content: string) => void;
    onMerge: () => void;
    onSubmitReview: () => void;
    onUpdateLifecycle: () => void;
    onSubmitComment: (content: string) => void;
  } = $props();
</script>

<article
  class="community-projects__review-detail"
  aria-label={showHeader ? undefined : pullRequest.title}
  aria-labelledby={showHeader ? "community-project-review-title" : undefined}
>
  <CommunityProjectsPullRequestMeta
    bind:descriptionOpen
    {pullRequest}
    {diff}
    {members}
    {rooms}
    {communityEmojis}
    {memberForPubkey}
    {onOpenProfile}
    {onMessageMember}
    {onWaveMember}
    {onCopyCommit}
  />
  <CommunityProjectsPullRequestFiles
    bind:open={filesOpen}
    bind:fileListOpen
    bind:fileFilter
    bind:fileListMode
    bind:selectedPath
    bind:collapsedPaths
    bind:viewedPaths
    bind:viewMode
    bind:scrollTarget
    bind:inlineContent
    {loading}
    {diff}
    {diffError}
    {visibleFiles}
    {viewedCount}
    {busy}
    {canCollaborate}
    {members}
    {rooms}
    {communityEmojis}
    {currentMemberId}
    {homeChannelId}
    {homeChannelName}
    {inlineComments}
    {showComposer}
    {memberForPubkey}
    {commentMessage}
    {canReact}
    {reactionOptions}
    {onSelectChannel}
    {onSelectPath}
    {onToggleFile}
    {onViewedChange}
    {onViewModeChange}
    {onAddLineComment}
    {onToggleReaction}
    {onCancelComposer}
    {onSubmitComposer}
  />
  <CommunityProjectsPullRequestCommits
    bind:commitsOpen
    bind:checksOpen
    {pullRequest}
    {onSelectCommit}
    {commitSummary}
  />
  <CommunityProjectsPullRequestConversation
    bind:open={activityOpen}
    bind:comment
    {pullRequest}
    {busy}
    {canCollaborate}
    {canMerge}
    {mergeError}
    {mergeStatus}
    {canSubmit}
    {canComment}
    {canUpdateLifecycle}
    {members}
    {rooms}
    {communityEmojis}
    {currentMemberId}
    {memberForPubkey}
    {commentMessage}
    {canReact}
    {reactionOptions}
    {onToggleReaction}
    {onOpenProfile}
    {onMessageMember}
    {onWaveMember}
    {onMerge}
    {onSubmitReview}
    {onUpdateLifecycle}
    {onSubmitComment}
  />
</article>
