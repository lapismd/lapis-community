<script lang="ts">
  import * as Breadcrumb from "@lapismd/design-core/shadcn/breadcrumb";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Table from "@lapismd/design-core/shadcn/table";
  import * as Tooltip from "@lapismd/design-core/shadcn/tooltip";
  import FileIcon from "@lucide/svelte/icons/file";
  import FolderIcon from "@lucide/svelte/icons/folder";
  import GitCommitHorizontalIcon from "@lucide/svelte/icons/git-commit-horizontal";

  import type {
    ProjectForgeCommit,
    ProjectForgeRef,
  } from "../../projects/index.js";
  import CommunitySidebarToggleIcon from "../community-app-shell/CommunitySidebarToggleIcon.svelte";
  import CommunityRelativeTime from "../community-relative-time/CommunityRelativeTime.svelte";
  import type { CommunityMemberModel } from "../community-workspace/model.js";
  import type {
    RepositoryBreadcrumbSegment,
    RepositoryBrowserEntry,
  } from "./repository-browser.js";
  import { repositoryParentPath } from "./repository-browser.js";
  import CommunityProjectsRepositoryBranchSelector from "./CommunityProjectsRepositoryBranchSelector.svelte";

  let {
    fileTreeOpen = $bindable(false),
    repositoryName,
    currentPath,
    breadcrumbs,
    branch,
    branches = [],
    entries,
    pathCommits,
    latestCommit,
    latestCommitAuthor,
    canLoadPathCommit = false,
    onSelectBranch,
    onOpenDirectory,
    onOpenFile,
    onSelectCommit,
  }: {
    fileTreeOpen?: boolean | undefined;
    repositoryName: string;
    currentPath: string;
    breadcrumbs: readonly RepositoryBreadcrumbSegment[];
    branch: string;
    branches?: readonly ProjectForgeRef[] | undefined;
    entries: readonly RepositoryBrowserEntry[];
    pathCommits: Readonly<Record<string, ProjectForgeCommit | undefined>>;
    latestCommit?: ProjectForgeCommit | undefined;
    latestCommitAuthor?: CommunityMemberModel | undefined;
    canLoadPathCommit?: boolean | undefined;
    onSelectBranch: (value: string | undefined) => void;
    onOpenDirectory: (path: string) => void;
    onOpenFile: (path: string) => void;
    onSelectCommit?: ((commit: ProjectForgeCommit) => void) | undefined;
  } = $props();

  const latestCommitDate = $derived(
    latestCommit?.commit_date ?? latestCommit?.author_date,
  );
</script>

<section class="community-projects__file-browser">
  <header class="community-projects__file-browser-toolbar">
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

    <Breadcrumb.Root aria-label="Repository directory path">
      <Breadcrumb.List>
        <Breadcrumb.Item>
          {#if breadcrumbs.length === 0}
            <Breadcrumb.Page>{repositoryName}</Breadcrumb.Page>
          {:else}
            <Breadcrumb.Link
              href="#"
              onclick={(event) => {
                event.preventDefault();
                onOpenDirectory("");
              }}>{repositoryName}</Breadcrumb.Link
            >
          {/if}
        </Breadcrumb.Item>
        {#each breadcrumbs as segment, index (segment.path)}
          <Breadcrumb.Separator />
          <Breadcrumb.Item>
            {#if index === breadcrumbs.length - 1}
              <Breadcrumb.Page>{segment.name}</Breadcrumb.Page>
            {:else}
              <Breadcrumb.Link
                href="#"
                onclick={(event) => {
                  event.preventDefault();
                  onOpenDirectory(segment.path);
                }}>{segment.name}</Breadcrumb.Link
              >
            {/if}
          </Breadcrumb.Item>
        {/each}
      </Breadcrumb.List>
    </Breadcrumb.Root>
  </header>

  {#if latestCommit && latestCommitAuthor}
    <div class="community-projects__file-browser-commit">
      <GitCommitHorizontalIcon aria-hidden="true" />
      <span>
        <strong>{latestCommitAuthor.name}</strong> committed
        <span>{latestCommit.subject}</span>
      </span>
      <button
        type="button"
        class="community-projects__file-browser-commit-link"
        title={`View commit ${latestCommit.sha.slice(0, 7)}`}
        aria-label={`View commit ${latestCommit.sha.slice(0, 7)}`}
        onclick={() => onSelectCommit?.(latestCommit)}
      >
        <code>{latestCommit.sha.slice(0, 7)}</code>
      </button>
      {#if latestCommitDate}
        <CommunityRelativeTime
          timestamp={Math.floor(new Date(latestCommitDate).getTime() / 1_000)}
        />
      {/if}
    </div>
  {/if}

  <Table.Root
    class="community-projects__file-browser-table"
    aria-label={currentPath ? `Files in ${currentPath}` : "Repository files"}
  >
    <Table.Header>
      <Table.Row>
        <Table.Head>Name</Table.Head>
        <Table.Head>Commit message</Table.Head>
        <Table.Head>Commit Date</Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#if currentPath}
        <Table.Row>
          <Table.Cell>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="community-projects__file-entry"
              aria-label="Go to parent directory"
              onclick={() => onOpenDirectory(repositoryParentPath(currentPath))}
            >
              <FolderIcon data-icon="inline-start" aria-hidden="true" />
              <strong>..</strong>
            </Button>
          </Table.Cell>
          <Table.Cell><span aria-hidden="true">—</span></Table.Cell>
          <Table.Cell><span aria-hidden="true">—</span></Table.Cell>
        </Table.Row>
      {/if}
      {#each entries as entry (entry.path)}
        {@const entryCommit = pathCommits[entry.path]}
        {@const entryCommitDate =
          entryCommit?.commit_date ?? entryCommit?.author_date}
        {@const commitLoaded = Object.prototype.hasOwnProperty.call(
          pathCommits,
          entry.path,
        )}
        <Table.Row>
          <Table.Cell>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="community-projects__file-entry"
              aria-label={`${entry.type === "tree" ? "Open directory" : "Open file"} ${entry.name}`}
              onclick={() =>
                entry.type === "tree"
                  ? onOpenDirectory(entry.path)
                  : onOpenFile(entry.path)}
            >
              {#if entry.type === "tree"}
                <FolderIcon data-icon="inline-start" aria-hidden="true" />
              {:else}
                <FileIcon data-icon="inline-start" aria-hidden="true" />
              {/if}
              <strong>{entry.name}</strong>
            </Button>
          </Table.Cell>
          <Table.Cell>
            <span
              class="community-projects__file-commit-message"
              title={entryCommit?.subject}
            >
              {entryCommit?.subject ??
                (canLoadPathCommit && !commitLoaded ? "Loading…" : "—")}
            </span>
          </Table.Cell>
          <Table.Cell>
            {#if entryCommitDate}
              <CommunityRelativeTime
                timestamp={Math.floor(
                  new Date(entryCommitDate).getTime() / 1_000,
                )}
              />
            {:else}
              <span aria-hidden="true">—</span>
            {/if}
          </Table.Cell>
        </Table.Row>
      {:else}
        <Table.Row>
          <Table.Cell colspan={3}>
            <p class="community-projects__status">
              This directory does not contain any files.
            </p>
          </Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>
</section>
