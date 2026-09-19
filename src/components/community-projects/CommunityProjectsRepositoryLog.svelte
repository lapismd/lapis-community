<script lang="ts">
  import * as Empty from "@lapismd/design-core/shadcn/empty";
  import GitCommitHorizontalIcon from "@lucide/svelte/icons/git-commit-horizontal";
  import { Skeleton } from "@lapismd/design-core/shadcn/skeleton";
  import * as ColumnCanvas from "@lapismd/design-core/shadcn/column-canvas";
  import { untrack } from "svelte";

  import type { NostrEvent } from "../../protocol/index.js";
  import type { ProjectForgeCommitResponse } from "../../projects/index.js";
  import { createRepositoryLogCanvas } from "../../projects/repository-log-canvas.js";
  import { buildRepositoryEvolutionLog } from "../../projects/repository-evolution-log.js";
  import { buildRepositoryLog } from "../../projects/repository-log.js";
  import { buildRepositoryOperationLog } from "../../projects/repository-operation-log.js";
  import {
    buildRepositoryAgentContexts,
    repositoryAgentContextsForSelection,
  } from "../../projects/repository-agent-context.js";
  import {
    REPOSITORY_LOG_PAGE_SIZE,
    nextRepositoryLogVisible,
    takeRepositoryLogPage,
  } from "../../projects/repository-log-page.js";
  import {
    createRepositoryLogPane,
    useRepositoryLogPane,
  } from "../../projects/repository-log-pane.svelte.js";
  import {
    REPOSITORY_LOG_FILES_UNAVAILABLE,
    repositoryLogChangedFiles,
    repositoryLogFilePatch,
    repositoryLogFilesError,
  } from "../../projects/repository-log-files.js";
  import CommunityProjectsRevisionGraph from "./CommunityProjectsRevisionGraph.svelte";
  import CommunityProjectsRepositoryLogDiff from "./CommunityProjectsRepositoryLogDiff.svelte";
  import CommunityProjectsRepositoryLogFiles from "./CommunityProjectsRepositoryLogFiles.svelte";
  import CommunityProjectsRepositoryAgentContext from "./CommunityProjectsRepositoryAgentContext.svelte";

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

  const pane = useRepositoryLogPane() ?? createRepositoryLogPane();
  const logGraph = $derived(buildRepositoryLog(events));
  const opGraph = $derived(buildRepositoryOperationLog(events));
  const graph = $derived(pane.pane === "oplog" ? opGraph : logGraph);
  let visibleCount = $state(REPOSITORY_LOG_PAGE_SIZE);
  const pagedGraph = $derived(takeRepositoryLogPage(graph, visibleCount));
  const evoGraph = $derived(
    pane.pane === "log" && pane.evologOpen && pane.selectedCommitId
      ? buildRepositoryEvolutionLog(
          events,
          pane.selectedCommitId,
          pane.selectedChangeId ?? "",
        )
      : { revisions: [], devices: [] },
  );
  const canvas = createRepositoryLogCanvas();
  let selectedId = $state<string | null>(null);
  const agentContexts = $derived(buildRepositoryAgentContexts(events));
  const selectedAgentContexts = $derived(
    repositoryAgentContextsForSelection(agentContexts, pane.pane, selectedId),
  );
  const selectedAgentRecordCount = $derived(
    selectedAgentContexts.reduce(
      (total, checkpoint) => total + checkpoint.records.length,
      0,
    ),
  );
  const selectedPath = $derived(canvas.pathAt(1) ?? null);
  let evoSelectedId = $state<string | null>(null);
  let detail = $state.raw<ProjectForgeCommitResponse | undefined>();
  let filesError = $state("");
  let filesRequest = $state<AbortController>();
  const files = $derived(repositoryLogChangedFiles(detail));
  const filePatch = $derived(repositoryLogFilePatch(detail, selectedPath));
  const showEvolog = $derived(
    pane.pane === "log" && pane.evologOpen && Boolean(pane.selectedCommitId),
  );

  $effect(() => {
    pane.pane;
    untrack(() => {
      visibleCount = REPOSITORY_LOG_PAGE_SIZE;
      canvas.clear();
      selectedId = null;
      evoSelectedId = null;
      detail = undefined;
      filesError = "";
    });
  });

  $effect(() => {
    if (!pane.evologOpen) return;
    if (canvas.isClosed("evolog")) {
      untrack(() => {
        pane.setEvologOpen(false);
        canvas.open("evolog");
        evoSelectedId = null;
      });
      return;
    }
    canvas.open("evolog");
  });

  $effect(() => {
    if (selectedAgentContexts.length > 0) canvas.open("agent-context");
  });

  async function loadFiles(
    eventId: string | null,
    empty = false,
  ): Promise<void> {
    filesRequest?.abort();
    detail = undefined;
    filesError = "";
    if (!eventId || empty) return;
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

  async function selectRevision(eventId: string): Promise<void> {
    canvas.select(0, eventId);
    const selected = canvas.pathAt(0) ?? null;
    selectedId = selected;
    const revision = graph.revisions.find((item) => item.eventId === selected);
    if (pane.pane === "log") {
      pane.setLogSelection(selected, revision?.changeId ?? null);
      evoSelectedId = null;
    }
    await loadFiles(revision?.commitId ?? selected, revision?.empty === true);
  }

  async function selectEvolution(eventId: string): Promise<void> {
    evoSelectedId = evoSelectedId === eventId ? null : eventId;
    const revision = evoGraph.revisions.find(
      (item) => item.eventId === evoSelectedId,
    );
    await loadFiles(evoSelectedId, revision?.empty === true);
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
          {pane.pane === "oplog"
            ? "Op Log appears after jj-nostr publishes kind 3904 for this repository."
            : "Repository Log appears after jj-nostr publishes kinds 3902 and 3903 for this repository. Commits still shows dest-Git history."}
        </Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {:else}
    <ColumnCanvas.Root controller={canvas}>
      <ColumnCanvas.Column
        id="revisions"
        title={pane.pane === "oplog" ? "Op Log" : "Log"}
        count={graph.revisions.length}
      >
        <ColumnCanvas.Body
          onScrollNearEnd={() => {
            visibleCount = nextRepositoryLogVisible(
              visibleCount,
              graph.revisions.length,
            );
          }}
        >
          <CommunityProjectsRevisionGraph
            revisions={pagedGraph.revisions}
            devices={pagedGraph.devices}
            {selectedId}
            graphLabel={pane.pane === "oplog"
              ? "Operation graph"
              : "Revision graph"}
            commitLabel={pane.pane === "oplog" ? "operation ID" : "commit ID"}
            onSelect={(revision) => void selectRevision(revision.eventId)}
          >
            {#snippet selectedFiles()}
              {#if !evoSelectedId}
                <CommunityProjectsRepositoryLogFiles
                  compact
                  {files}
                  {selectedPath}
                  error={filesError}
                  onSelectPath={(path) => {
                    if (canvas.pathAt(1) !== path) canvas.select(1, path);
                  }}
                />
              {/if}
            {/snippet}
          </CommunityProjectsRevisionGraph>
        </ColumnCanvas.Body>
      </ColumnCanvas.Column>
      {#if selectedAgentContexts.length > 0}
        <ColumnCanvas.Column
          id="agent-context"
          title="Agent context"
          count={selectedAgentRecordCount}
        >
          <ColumnCanvas.Body>
            <CommunityProjectsRepositoryAgentContext
              checkpoints={selectedAgentContexts}
            />
          </ColumnCanvas.Body>
        </ColumnCanvas.Column>
      {/if}
      {#if showEvolog}
        <ColumnCanvas.Column
          id="evolog"
          title="Evolog"
          count={evoGraph.revisions.length}
        >
          <ColumnCanvas.Body>
            <CommunityProjectsRevisionGraph
              revisions={evoGraph.revisions}
              selectedId={evoSelectedId}
              graphLabel="Evolution log"
              onSelect={(revision) => void selectEvolution(revision.eventId)}
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
      {/if}
      <CommunityProjectsRepositoryLogDiff
        path={selectedPath}
        patch={filePatch}
        {files}
      />
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
