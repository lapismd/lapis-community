<script lang="ts">
  import { agentContextRecordCount } from "../../projects/agent-context-record-count.js";
  import { Skeleton } from "@lapismd/design-core/shadcn/skeleton";
  import * as ColumnCanvas from "@lapismd/design-core/shadcn/column-canvas";
  import { untrack } from "svelte";
  import { projectRouteToHash } from "../community-application/project-route.js";

  import type { NostrEvent } from "../../protocol/index.js";
  import type {
    ProjectForgeCommitResponse,
    ProjectForgeRef,
  } from "../../projects/index.js";
  import { repositoryLogBranchSeed } from "../../projects/repository-log-branch.js";
  import { createRepositoryLogSelection } from "../../projects/repository-log-selection.svelte.js";
  import { createRepositoryLogCanvas } from "../../projects/repository-log-canvas.js";
  import { buildRepositoryEvolutionLog } from "../../projects/repository-evolution-log.js";
  import { buildRepositoryLog } from "../../projects/repository-log.js";
  import { buildRepositoryOperationLog } from "../../projects/repository-operation-log.js";
  import {
    buildRepositoryAgentContexts,
    repositoryAgentContextsForSelection,
  } from "../../projects/repository-agent-context.js";
  import {
    createRepositoryLogPane,
    useRepositoryLogPane,
  } from "../../projects/repository-log-pane.svelte.js";
  import {
    repositoryLogChangedFiles,
    repositoryLogFilePatch,
  } from "../../projects/repository-log-files.js";
  import CommunityProjectsRevisionGraph from "./CommunityProjectsRevisionGraph.svelte";
  import CommunityProjectsRepositoryLogHeader from "./CommunityProjectsRepositoryLogHeader.svelte";
  import CommunityProjectsRepositoryLogEmpty from "./CommunityProjectsRepositoryLogEmpty.svelte";
  import CommunityProjectsRepositoryLogDiff from "./CommunityProjectsRepositoryLogDiff.svelte";
  import CommunityProjectsRepositoryLogFiles from "./CommunityProjectsRepositoryLogFiles.svelte";
  import CommunityProjectsRepositoryAgentContext from "./CommunityProjectsRepositoryAgentContext.svelte";
  import type { CommunityMemberModel } from "../community-workspace/model.js";

  let {
    events = [],
    loading = false,
    members = [],
    repositoryAddress,
    branch = "",
    branches = [],
    onSelectBranch,
    onLoadRepositoryCommit,
  }: {
    events?: readonly NostrEvent[] | undefined;
    loading?: boolean | undefined;
    members?: readonly CommunityMemberModel[];
    repositoryAddress?: string;
    branch?: string | undefined;
    branches?: readonly ProjectForgeRef[] | undefined;
    onSelectBranch?: ((value: string | undefined) => void) | undefined;
    onLoadRepositoryCommit?:
      | ((
          sha: string,
          signal?: AbortSignal,
        ) => Promise<ProjectForgeCommitResponse>)
      | undefined;
  } = $props();

  const pane = useRepositoryLogPane() ?? createRepositoryLogPane();
  const selectedBranchCommitId = $derived(
    repositoryLogBranchSeed(branches, branch),
  );
  const logGraph = $derived(
    buildRepositoryLog(events, pane.requestedCommitId, selectedBranchCommitId),
  );
  const opGraph = $derived(buildRepositoryOperationLog(events));
  const graph = $derived(pane.pane === "oplog" ? opGraph : logGraph);
  const revisionsTitle = $derived(pane.pane === "oplog" ? "Op Log" : "Log");
  let previousLogBranch = $state(untrack(() => branch));
  let branchRefreshPending = $state(false);
  const hasRevisions = $derived(graph.revisions.length > 0);
  const showBranchSkeleton = $derived(branchRefreshPending && loading);
  const showInitialSkeleton = $derived(
    loading && !hasRevisions && !branchRefreshPending,
  );
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
  const selection = createRepositoryLogSelection({
    pane,
    canvas,
    graph: () => graph,
    logGraph: () => logGraph,
    scope: () => repositoryAddress,
    loading: () => loading,
    reveal: () => {},
    loadCommit: () => onLoadRepositoryCommit,
  });
  const agentContexts = $derived(buildRepositoryAgentContexts(events));
  const selectedAgentContexts = $derived(
    repositoryAgentContextsForSelection(agentContexts, pane.pane, selection.id),
  );
  const selectedAgentRecordCount = $derived(
    agentContextRecordCount(selectedAgentContexts),
  );
  const selectedPath = $derived(canvas.pathAt(1) ?? null);
  const files = $derived(repositoryLogChangedFiles(selection.detail));
  const filePatch = $derived(
    repositoryLogFilePatch(selection.detail, selectedPath),
  );
  const showEvolog = $derived(
    pane.pane === "log" && pane.evologOpen && Boolean(pane.selectedCommitId),
  );

  $effect(() => {
    if (!pane.evologOpen) return;
    if (canvas.isClosed("evolog")) {
      untrack(() => {
        pane.setEvologOpen(false);
        canvas.open("evolog");
        selection.clearEvolution();
      });
      return;
    }
    canvas.open("evolog");
  });

  $effect(() => {
    if (selectedAgentContexts.length > 0) canvas.open("agent-context");
  });

  $effect(() => {
    if (branch !== previousLogBranch) {
      previousLogBranch = branch;
      branchRefreshPending = pane.pane === "log";
    }
    if (!loading) branchRefreshPending = false;
  });

  function selectLogBranch(value: string | undefined): void {
    if (!value || value === branch) return;
    onSelectBranch?.(value);
    pane.navigateToCommit(null);
    pane.setLogSelection(null, null);
    canvas.clear();
  }
</script>

<section class="community-projects-repository-log" aria-label="Repository log">
  {#if selection.unavailable}
    <p role="status">This commit is not available in the repository log.</p>
  {/if}
  {#if showInitialSkeleton}
    <div class="community-projects-repository-log__skeleton" aria-busy="true">
      <span class="sr-only">Loading repository log</span>
      <Skeleton />
      <Skeleton />
      <Skeleton />
    </div>
  {:else}
    <ColumnCanvas.Root controller={canvas}>
      <ColumnCanvas.Column id="revisions">
        <CommunityProjectsRepositoryLogHeader
          title={revisionsTitle}
          count={graph.revisions.length}
          branch={pane.pane === "log" ? branch : ""}
          branches={pane.pane === "log" ? branches : []}
          onSelectBranch={pane.pane === "log" ? selectLogBranch : undefined}
        />
        <ColumnCanvas.Body>
          {#if showBranchSkeleton}
            <div
              class="community-projects-repository-log__skeleton"
              aria-busy="true"
            >
              <span class="sr-only">Loading repository log branch</span>
              <Skeleton />
              <Skeleton />
              <Skeleton />
            </div>
          {:else if !hasRevisions}
            <CommunityProjectsRepositoryLogEmpty pane={pane.pane} {branch} />
          {:else}
            <CommunityProjectsRevisionGraph
              {members}
              revisions={graph.revisions}
              devices={graph.devices}
              selectedId={selection.id}
              revisionHref={(revision) =>
                repositoryAddress && pane.pane === "log"
                  ? projectRouteToHash({
                      kind: "repository",
                      coordinate: repositoryAddress,
                      surface: "log",
                      commitSha: revision.eventId,
                    })
                  : undefined}
              graphLabel={pane.pane === "oplog"
                ? "Operation graph"
                : "Revision graph"}
              commitLabel={pane.pane === "oplog" ? "operation ID" : "commit ID"}
              onSelect={(revision) =>
                void selection.selectRevision(revision.eventId)}
            >
              {#snippet selectedFiles()}
                {#if !selection.evolutionId}
                  <CommunityProjectsRepositoryLogFiles
                    compact
                    {files}
                    {selectedPath}
                    error={selection.error}
                    onSelectPath={(path) => {
                      if (canvas.pathAt(1) !== path) canvas.select(1, path);
                    }}
                  />
                {/if}
              {/snippet}
            </CommunityProjectsRevisionGraph>
          {/if}
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
              {members}
              {...repositoryAddress ? { repositoryAddress } : {}}
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
              {members}
              revisions={evoGraph.revisions}
              selectedId={selection.evolutionId}
              graphLabel="Evolution log"
              onSelect={(revision) =>
                void selection.selectEvolution(
                  revision.eventId,
                  revision.empty,
                )}
            >
              {#snippet selectedFiles()}
                <CommunityProjectsRepositoryLogFiles
                  compact
                  {files}
                  {selectedPath}
                  error={selection.error}
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
        checkpoints={selectedAgentContexts}
        commitId={selection.id ?? undefined}
        base={selection.detail?.commit.parents?.[0]}
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
