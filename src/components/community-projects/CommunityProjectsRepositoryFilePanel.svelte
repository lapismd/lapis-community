<script lang="ts">
  import { resolveDiffLanguage } from "@lapismd/design-core/diff";
  import * as Breadcrumb from "@lapismd/design-core/shadcn/breadcrumb";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as ButtonGroup from "@lapismd/design-core/shadcn/button-group";
  import { CodeBlock } from "@lapismd/design-core/shadcn/code-block";
  import * as Empty from "@lapismd/design-core/shadcn/empty";
  import { ScrollArea } from "@lapismd/design-core/shadcn/scroll-area";
  import { Skeleton } from "@lapismd/design-core/shadcn/skeleton";
  import * as Tooltip from "@lapismd/design-core/shadcn/tooltip";
  import CodeXmlIcon from "@lucide/svelte/icons/code-xml";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import FileIcon from "@lucide/svelte/icons/file";

  import type { CommunityCustomEmoji } from "../../community/index.js";
  import type {
    ProjectForgeBlobResponse,
    ProjectForgeRef,
  } from "../../projects/index.js";
  import CommunitySidebarToggleIcon from "../community-app-shell/CommunitySidebarToggleIcon.svelte";
  import CommunityMarkdownContent from "../community-markdown-content/CommunityMarkdownContent.svelte";
  import type {
    CommunityMemberModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";
  import type { RepositoryBreadcrumbSegment } from "./repository-browser.js";
  import CommunityProjectsRepositoryBranchSelector from "./CommunityProjectsRepositoryBranchSelector.svelte";

  let {
    fileTreeOpen = $bindable(false),
    markdownView = $bindable("preview"),
    loading = false,
    selectedPath = "",
    blob,
    isMarkdown,
    breadcrumbs,
    branch,
    branches = [],
    members = [],
    rooms = [],
    communityEmojis = [],
    onSelectBranch,
    onOpenDirectory,
  }: {
    fileTreeOpen?: boolean | undefined;
    markdownView?: "preview" | "source" | undefined;
    loading?: boolean | undefined;
    selectedPath?: string | undefined;
    blob?: ProjectForgeBlobResponse | undefined;
    isMarkdown: boolean;
    breadcrumbs: readonly RepositoryBreadcrumbSegment[];
    branch: string;
    branches?: readonly ProjectForgeRef[] | undefined;
    members?: readonly CommunityMemberModel[] | undefined;
    rooms?: readonly CommunityRoomModel[] | undefined;
    communityEmojis?: readonly CommunityCustomEmoji[] | undefined;
    onSelectBranch: (value: string | undefined) => void;
    onOpenDirectory: (path: string) => void;
  } = $props();

  const fileName = $derived(selectedPath.split("/").at(-1) ?? selectedPath);
</script>

<section class="community-projects__file-panel">
  <header class="community-projects__file-header">
    {#if !fileTreeOpen}
      <Tooltip.Provider delayDuration={0}>
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Show repository file tree"
                onclick={() => (fileTreeOpen = true)}
              >
                <CommunitySidebarToggleIcon
                  side="left"
                  expanded={fileTreeOpen}
                />
              </Button>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content side="bottom" sideOffset={6}
            >Show file tree</Tooltip.Content
          >
        </Tooltip.Root>
      </Tooltip.Provider>
      <CommunityProjectsRepositoryBranchSelector
        {branch}
        {branches}
        {onSelectBranch}
      />
    {/if}
    <Breadcrumb.Root aria-label="Repository file path">
      <Breadcrumb.List>
        <Breadcrumb.Item>
          <Breadcrumb.Link
            href="#"
            onclick={(event) => {
              event.preventDefault();
              onOpenDirectory("");
            }}>Files</Breadcrumb.Link
          >
        </Breadcrumb.Item>
        {#each breadcrumbs as segment (segment.path)}
          <Breadcrumb.Separator />
          <Breadcrumb.Item>
            <Breadcrumb.Link
              href="#"
              onclick={(event) => {
                event.preventDefault();
                onOpenDirectory(segment.path);
              }}>{segment.name}</Breadcrumb.Link
            >
          </Breadcrumb.Item>
        {/each}
        <Breadcrumb.Separator />
        <Breadcrumb.Item>
          <Breadcrumb.Page>{fileName}</Breadcrumb.Page>
        </Breadcrumb.Item>
      </Breadcrumb.List>
    </Breadcrumb.Root>
    {#if isMarkdown}
      <ButtonGroup.Root
        class="community-projects__file-view-toggle"
        aria-label="Markdown display"
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-selected={markdownView === "preview"}
          aria-pressed={markdownView === "preview"}
          onclick={() => (markdownView = "preview")}
        >
          <EyeIcon data-icon="inline-start" aria-hidden="true" />
          Preview
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-selected={markdownView === "source"}
          aria-pressed={markdownView === "source"}
          onclick={() => (markdownView = "source")}
        >
          <CodeXmlIcon data-icon="inline-start" aria-hidden="true" />
          Source
        </Button>
      </ButtonGroup.Root>
    {/if}
  </header>
  <ScrollArea
    type="hover"
    orientation="both"
    class="community-projects__file-body"
  >
    {#if loading && !blob}
      <div
        class="community-projects__blob-skeleton"
        role="status"
        aria-label={`Loading ${selectedPath}`}
      >
        {#if isMarkdown}
          <Skeleton class="community-projects__markdown-skeleton-title" />
          <Skeleton class="community-projects__markdown-skeleton-copy" />
          <Skeleton class="community-projects__markdown-skeleton-copy" />
          <Skeleton class="community-projects__markdown-skeleton-heading" />
          <Skeleton class="community-projects__markdown-skeleton-copy" />
          <Skeleton class="community-projects__markdown-skeleton-code" />
        {:else}
          <div class="community-projects__files-loading-code">
            {#each [0, 1, 2, 3, 4, 5, 6] as row (row)}
              <div>
                <Skeleton />
                <Skeleton />
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {:else if blob?.binary}
      <Empty.Root>
        <Empty.Header>
          <Empty.Media variant="icon"><FileIcon aria-hidden="true" /></Empty.Media>
          <Empty.Title>Binary file</Empty.Title>
          <Empty.Description
            >{blob.path} cannot be previewed as text.</Empty.Description
          >
        </Empty.Header>
      </Empty.Root>
    {:else if blob?.too_large}
      <p class="community-projects__status">
        {blob.path} is too large to preview.
      </p>
    {:else if blob && isMarkdown && markdownView === "preview"}
      <CommunityMarkdownContent
        class="community-projects__markdown-file"
        content={blob.contents ?? ""}
        {members}
        {rooms}
        {communityEmojis}
      />
    {:else if blob}
      <CodeBlock
        code={blob.contents ?? ""}
        language={resolveDiffLanguage(blob.path) ?? "plaintext"}
        hasLanguageLabel={false}
        hasCopyButton={false}
        hasLineNumbers
        width="100%"
        container="section"
      />
    {:else}
      <p class="community-projects__status">Select a file to preview it.</p>
    {/if}
  </ScrollArea>
</section>
