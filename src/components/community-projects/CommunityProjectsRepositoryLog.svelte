<script lang="ts">
  import * as Empty from "@lapismd/design-core/shadcn/empty";
  import GitCommitHorizontalIcon from "@lucide/svelte/icons/git-commit-horizontal";
  import { Skeleton } from "@lapismd/design-core/shadcn/skeleton";
  import { FileDiff } from "@lapismd/design-core/diff";
  import * as ColumnCanvas from "@lapismd/design-core/shadcn/column-canvas";

  import type { NostrEvent } from "../../protocol/index.js";
  import type { ProjectForgeCommitResponse } from "../../projects/index.js";
  import { createRepositoryLogCanvas } from "../../projects/repository-log-canvas.js";
  import { buildRepositoryLog } from "../../projects/repository-log.js";
  import {
    REPOSITORY_LOG_FILES_UNAVAILABLE,
    repositoryLogChangedFiles,
    repositoryLogFilePatch,
    repositoryLogFilesError,
  } from "../../projects/repository-log-files.js";
  import CommunityProjectsRevisionGraph from "./CommunityProjectsRevisionGraph.svelte";
  import CommunityProjectsRepositoryLogFiles from "./CommunityProjectsRepositoryLogFiles.svelte";

  let {
    events = [],
    loading = false,
    onLoadRepositoryCommit,
  }: {
    events?: readonly NostrEvent[] | undefined;
    loading?: boolean | undefined;
    onLoadRepositoryCommit?:
      | ((
          sha: string,
          signal?: AbortSignal,
        ) => Promise<ProjectForgeCommitResponse>)
      | undefined;
  } = $props();

  const graph = $derived(buildRepositoryLog(events));
  const canvas = createRepositoryLogCanvas();
  const selectedId = $derived(canvas.pathAt(0) ?? null);
  const selectedPath = $derived(canvas.pathAt(1) ?? null);
  let detail = $state.raw<ProjectForgeCommitResponse | undefined>();
  let filesError = $state("");
  let filesRequest = $state<AbortController>();
  const files = $derived(repositoryLogChangedFiles(detail));
  const filePatch = $derived(repositoryLogFilePatch(detail, selectedPath));

  async function selectRevision(eventId: string): Promise<void> {
    filesRequest?.abort();
    canvas.select(0, eventId);
    const selected = canvas.pathAt(0);
    detail = undefined;
    filesError = "";
    if (!selected) return;
    if (graph.revisions.find((item) => item.eventId === selected)?.empty) {
      return;
    }
    if (!onLoadRepositoryCommit) {
      filesError = REPOSITORY_LOG_FILES_UNAVAILABLE;
      return;
    }
    const controller = new AbortController();
    filesRequest = controller;
    try {
      detail = await onLoadRepositoryCommit(eventId, controller.signal);
    } catch (cause) {
      if (controller.signal.aborted) return;
      filesError = repositoryLogFilesError(cause);
    }
  }
</script>

<section class="community-projects-repository-log" aria-label="Repository log">
  {#if loading && graph.revisions.length === 0}
    <div class="community-projects-repository-log__skeleton" aria-busy="true">
      <span class="sr-only">Loading repository log</span>
      <Skeleton />
      <Skeleton />
      <Skeleton />
    </div>
  {:else if graph.revisions.length === 0}
    <Empty.Root class="community-projects__empty">
      <Empty.Header>
        <Empty.Media variant="icon"
          ><GitCommitHorizontalIcon aria-hidden="true" /></Empty.Media
        >
        <Empty.Title>No projection yet</Empty.Title>
        <Empty.Description>
          Repository Log appears after jj-nostr publishes kinds 3902 and 3903
          for this repository. Commits still shows dest-Git history.
        </Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {:else}
    <ColumnCanvas.Root controller={canvas}>
      <ColumnCanvas.Column
        id="revisions"
        title="Log"
        count={graph.revisions.length}
      >
        <ColumnCanvas.Body>
          <CommunityProjectsRevisionGraph
            revisions={graph.revisions}
            devices={graph.devices}
            {selectedId}
            onSelect={(revision) => void selectRevision(revision.eventId)}
          >
            {#snippet selectedFiles()}
              <CommunityProjectsRepositoryLogFiles
                compact
                {files}
                {selectedPath}
                error={filesError}
                onSelectPath={(path) => {
                  if (canvas.pathAt(1) !== path) canvas.select(1, path);
                }}
              />
            {/snippet}
          </CommunityProjectsRevisionGraph>
        </ColumnCanvas.Body>
      </ColumnCanvas.Column>
      <ColumnCanvas.Column id="diff" title={selectedPath ?? "Diff"}>
        <ColumnCanvas.Body>
          {#if selectedPath && filePatch}
            <FileDiff path={selectedPath} patch={filePatch} />
          {/if}
        </ColumnCanvas.Body>
      </ColumnCanvas.Column>
    </ColumnCanvas.Root>
  {/if}
</section>

<style>
  .community-projects-repository-log {
    display: flex;
    min-height: 0;
    flex: 1 1 auto;
    flex-direction: column;
    width: 100%;
    overflow: hidden;
  }

  .community-projects-repository-log
    :global([data-ui-component="column-canvas"][data-ui-part="root"]) {
    min-height: 0;
    flex: 1 1 auto;
  }

  .community-projects-repository-log__skeleton {
    display: grid;
    gap: 0.75rem;
    padding: 1rem;
  }
</style>
