<script lang="ts">
  import {
    FileChangeStats,
    FileDiffComposer,
    FileListing,
    FileListingViewModeToggle,
    type FileDiffComposerFileContext,
    type FileDiffFileScrollTarget,
    type FileDiffLineContext,
    type FileDiffViewMode,
    type FileListingViewMode,
  } from "@lapismd/design-core/diff";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { Checkbox } from "@lapismd/design-core/shadcn/checkbox";
  import * as DropdownMenu from "@lapismd/design-core/shadcn/dropdown-menu";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import { ScrollArea } from "@lapismd/design-core/shadcn/scroll-area";
  import MessageSquarePlusIcon from "@lucide/svelte/icons/message-square-plus";
  import Settings2Icon from "@lucide/svelte/icons/settings-2";

  import type { CommunityCustomEmoji } from "../../community/index.js";
  import type {
    ProjectForgePullRequestDiff,
    PullRequestComment,
  } from "../../projects/index.js";
  import CommunitySidebarToggleIcon from "../community-app-shell/CommunitySidebarToggleIcon.svelte";
  import type {
    CommunityMemberModel,
    CommunityMessageModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";
  import type { CommunityProjectsDiffFile } from "./model.js";
  import CommunityProjectsPullRequestInlineThread from "./CommunityProjectsPullRequestInlineThread.svelte";
  import { diffLineSide } from "./pull-request-review.js";

  let {
    fileListOpen = $bindable(true),
    fileFilter = $bindable(""),
    fileListMode = $bindable("tree" as FileListingViewMode),
    selectedPath = $bindable(""),
    collapsedPaths = $bindable<string[]>([]),
    viewedPaths = $bindable<string[]>([]),
    viewMode = $bindable("unified" as FileDiffViewMode),
    scrollTarget = $bindable<FileDiffFileScrollTarget | null>(null),
    inlineContent = $bindable(""),
    diff,
    visibleFiles,
    viewedCount,
    busy = false,
    canCollaborate = false,
    members = [],
    rooms = [],
    communityEmojis = [],
    currentMemberId,
    inlineComments,
    showComposer,
    memberForPubkey,
    commentMessage,
    canReact,
    reactionOptions,
    onSelectPath,
    onToggleFile,
    onViewedChange,
    onViewModeChange,
    onAddLineComment,
    onToggleReaction,
    onCancelComposer,
    onSubmitComposer,
  }: {
    fileListOpen?: boolean | undefined;
    fileFilter?: string | undefined;
    fileListMode?: FileListingViewMode | undefined;
    selectedPath?: string | undefined;
    collapsedPaths?: string[] | undefined;
    viewedPaths?: string[] | undefined;
    viewMode?: FileDiffViewMode | undefined;
    scrollTarget?: FileDiffFileScrollTarget | null | undefined;
    inlineContent?: string | undefined;
    diff: ProjectForgePullRequestDiff;
    visibleFiles: readonly CommunityProjectsDiffFile[];
    viewedCount: number;
    busy?: boolean | undefined;
    canCollaborate?: boolean | undefined;
    members?: readonly CommunityMemberModel[] | undefined;
    rooms?: readonly CommunityRoomModel[] | undefined;
    communityEmojis?: readonly CommunityCustomEmoji[] | undefined;
    currentMemberId?: string | undefined;
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

<div class="community-projects__diff-summary">
  <span class="community-projects__diff-summary-copy">
    <strong>{diff.files.length} changed files</strong>
    <span>{viewedCount} of {diff.files.length} viewed</span>
  </span>
  <span class="community-projects__diff-summary-actions">
    <FileChangeStats
      additions={diff.files.reduce((total, file) => total + file.additions, 0)}
      deletions={diff.files.reduce((total, file) => total + file.deletions, 0)}
    />
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button
            {...props}
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Diff settings"
            title="Diff settings"
          >
            <Settings2Icon aria-hidden="true" />
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" sideOffset={4}>
        <DropdownMenu.Label>Diff layout</DropdownMenu.Label>
        <DropdownMenu.RadioGroup
          value={viewMode}
          onValueChange={onViewModeChange}
        >
          <DropdownMenu.RadioItem value="unified"
            >Unified diff</DropdownMenu.RadioItem
          >
          <DropdownMenu.RadioItem value="split"
            >Split diff</DropdownMenu.RadioItem
          >
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </span>
</div>
<div class="community-projects__diff-layout" data-file-list-open={fileListOpen}>
  {#if fileListOpen}
    <aside aria-label="Changed files">
      <ScrollArea
        type="hover"
        orientation="vertical"
        class="community-projects__changed-files-scroll-area"
      >
        <Input
          type="search"
          bind:value={fileFilter}
          class="community-projects__changed-files-filter"
          aria-label="Filter changed files"
          placeholder="Filter changed files"
        />
        <div class="community-projects__changed-files-toolbar">
          <span>Files</span>
          <FileListingViewModeToggle bind:mode={fileListMode} />
        </div>
        <FileListing
          files={[...visibleFiles]}
          mode={fileListMode}
          {selectedPath}
          {onSelectPath}
        />
      </ScrollArea>
    </aside>
  {/if}
  <div class="community-projects__diff-content">
    {#snippet reviewFileHeaderLeading(_context: FileDiffComposerFileContext)}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        class="community-projects__diff-sidebar-toggle"
        aria-label={fileListOpen ? "Hide changed files" : "Show changed files"}
        aria-expanded={fileListOpen}
        data-ui-part="sidebar-toggle"
        data-side="left"
        data-state={fileListOpen ? "expanded" : "collapsed"}
        title={fileListOpen ? "Hide changed files" : "Show changed files"}
        onclick={() => (fileListOpen = !fileListOpen)}
      >
        <CommunitySidebarToggleIcon expanded={fileListOpen} />
      </Button>
    {/snippet}
    {#snippet reviewFileHeader(context: FileDiffComposerFileContext)}
      <label class="community-projects__viewed-file">
        <Checkbox
          checked={viewedPaths.includes(context.path)}
          onCheckedChange={(checked) =>
            onViewedChange(context.path, checked === true)}
          aria-label={"Mark " + context.path + " as viewed"}
        />
        <span>Viewed</span>
      </label>
    {/snippet}
    {#snippet lineComment(context: FileDiffLineContext)}
      {#if context.lineNumber !== null}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          class="community-projects__line-comment"
          aria-label={`Comment on ${context.path} line ${context.lineNumber}`}
          title="Add inline comment"
          onclick={() => onAddLineComment(context)}
        >
          <MessageSquarePlusIcon aria-hidden="true" />
        </Button>
      {/if}
    {/snippet}
    {#snippet inlineDiscussion(context: FileDiffLineContext)}
      <CommunityProjectsPullRequestInlineThread
        {context}
        comments={inlineComments(context)}
        showComposer={showComposer(context)}
        bind:composerContent={inlineContent}
        {busy}
        {canCollaborate}
        {members}
        {rooms}
        {communityEmojis}
        {currentMemberId}
        {memberForPubkey}
        {commentMessage}
        {canReact}
        {reactionOptions}
        {onToggleReaction}
        {onCancelComposer}
        {onSubmitComposer}
        linePrefix={diffLineSide(context.variant) === "new" ? "+" : "-"}
      />
    {/snippet}
    <FileDiffComposer
      files={[...visibleFiles]}
      {viewMode}
      {selectedPath}
      collapsedFilePaths={collapsedPaths}
      scrollToFile={scrollTarget}
      stickyHeaders
      onFileToggle={onToggleFile}
      fileHeaderLeading={reviewFileHeaderLeading}
      fileHeaderTrailing={reviewFileHeader}
      lineAccessory={lineComment}
      lineAnnotation={inlineDiscussion}
    />
  </div>
</div>
