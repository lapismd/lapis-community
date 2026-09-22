import { onDestroy, untrack } from "svelte";
import type { ProjectForgeCommitResponse } from "./model.js";
import type { createRepositoryLogCanvas } from "./repository-log-canvas.js";
import type { RepositoryLogGraph } from "./repository-log.js";
import type { RepositoryLogPaneState } from "./repository-log-pane.svelte.js";
import {
  REPOSITORY_LOG_FILES_UNAVAILABLE,
  repositoryLogFilesError,
} from "./repository-log-files.js";

export function createRepositoryLogSelection(options: {
  pane: RepositoryLogPaneState;
  canvas: ReturnType<typeof createRepositoryLogCanvas>;
  graph(): RepositoryLogGraph;
  logGraph(): RepositoryLogGraph;
  scope(): string | undefined;
  loading(): boolean;
  reveal(count: number): void;
  loadCommit():
    | ((
        sha: string,
        signal?: AbortSignal,
      ) => Promise<ProjectForgeCommitResponse>)
    | undefined;
}) {
  const { pane, canvas } = options;
  let id = $state<string | null>(null);
  let evolutionId = $state<string | null>(null);
  let detail = $state.raw<ProjectForgeCommitResponse>();
  let error = $state("");
  let request: AbortController | undefined;
  let restored: string | null | undefined;
  let previousPane: string | undefined;
  let previousScope: string | undefined;

  function clear() {
    request?.abort();
    canvas.clear();
    id = null;
    evolutionId = null;
    detail = undefined;
    error = "";
  }

  async function loadFiles(commitId: string | null, empty = false) {
    request?.abort();
    detail = undefined;
    error = "";
    if (!commitId || empty || options.loading()) return;
    const load = options.loadCommit();
    if (!load) {
      error = REPOSITORY_LOG_FILES_UNAVAILABLE;
      return;
    }
    const controller = new AbortController();
    request = controller;
    try {
      const result = await load(commitId, controller.signal);
      if (!controller.signal.aborted) detail = result;
    } catch (cause) {
      if (!controller.signal.aborted) error = repositoryLogFilesError(cause);
    }
  }

  function showRevision(commitId: string | null) {
    if (canvas.pathAt(0) !== commitId) {
      if (commitId) canvas.select(0, commitId);
      else canvas.clear();
    }
    id = commitId;
    evolutionId = null;
    const revision = options
      .graph()
      .revisions.find((row) => row.eventId === id);
    if (pane.pane === "log")
      pane.setLogSelection(
        id,
        revision?.changeId ?? null,
        revision
          ? {
              ...(revision.commitId ? { commitId: revision.commitId } : {}),
              empty: revision.empty,
              message: revision.message,
            }
          : undefined,
      );
    return loadFiles(revision?.commitId ?? id, revision?.empty === true);
  }

  $effect(() => {
    const activePane = pane.pane;
    const scope = options.scope();
    const requested = pane.requestedCommitId;
    const loading = options.loading();
    const revisions = options.logGraph().revisions;
    untrack(() => {
      if (activePane !== previousPane || scope !== previousScope) {
        clear();
        options.reveal(0);
        restored = undefined;
        previousPane = activePane;
        previousScope = scope;
      }
      if (loading) return;
      if (
        activePane !== "log" ||
        requested === undefined ||
        requested === restored
      )
        return;
      if (requested === null) {
        restored = null;
        void showRevision(null);
        return;
      }
      const index = revisions.findIndex((row) => row.eventId === requested);
      if (index < 0) {
        clear();
        pane.setLogSelection(null, null);
        return;
      }
      restored = requested;
      options.reveal(index + 1);
      void showRevision(requested);
    });
  });

  onDestroy(() => request?.abort());
  return {
    get id() {
      return id;
    },
    get evolutionId() {
      return evolutionId;
    },
    get detail() {
      return detail;
    },
    get error() {
      return error;
    },
    get unavailable() {
      const requested = pane.requestedCommitId;
      return pane.pane === "log" &&
        requested &&
        !options.loading() &&
        !options.logGraph().revisions.some((row) => row.eventId === requested)
        ? requested
        : null;
    },
    selectRevision(commitId: string) {
      const next = id === commitId ? null : commitId;
      if (pane.pane === "log") {
        restored = options.loading() ? undefined : next;
        pane.navigateToCommit(next);
      }
      return showRevision(next);
    },
    selectEvolution(commitId: string, empty: boolean) {
      evolutionId = evolutionId === commitId ? null : commitId;
      return loadFiles(evolutionId, empty);
    },
    clearEvolution() {
      evolutionId = null;
    },
  };
}
