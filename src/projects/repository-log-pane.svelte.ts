import { getContext, setContext } from "svelte";

export type RepositoryLogPane = "log" | "oplog";

export type RepositoryLogPaneState = {
  readonly pane: RepositoryLogPane;
  readonly evologOpen: boolean;
  readonly selectedCommitId: string | null;
  readonly selectedChangeId: string | null;
  selectPane(pane: RepositoryLogPane): void;
  toggleEvolog(): void;
  setLogSelection(commitId: string | null, changeId: string | null): void;
  reset(): void;
};

const paneContextKey = Symbol("repository-log-pane");

export function createRepositoryLogPane(): RepositoryLogPaneState {
  let pane = $state<RepositoryLogPane>("log");
  let evologOpen = $state(false);
  let selectedCommitId = $state<string | null>(null);
  let selectedChangeId = $state<string | null>(null);

  function selectPane(next: RepositoryLogPane): void {
    pane = next;
    if (next === "oplog") {
      evologOpen = false;
      selectedCommitId = null;
      selectedChangeId = null;
    }
  }

  return {
    get pane() {
      return pane;
    },
    get evologOpen() {
      return evologOpen;
    },
    get selectedCommitId() {
      return selectedCommitId;
    },
    get selectedChangeId() {
      return selectedChangeId;
    },
    selectPane,
    toggleEvolog(): void {
      if (pane !== "log" || !selectedCommitId) return;
      evologOpen = !evologOpen;
    },
    setLogSelection(commitId: string | null, changeId: string | null): void {
      selectedCommitId = commitId;
      selectedChangeId = changeId;
      if (!commitId) evologOpen = false;
    },
    reset(): void {
      pane = "log";
      evologOpen = false;
      selectedCommitId = null;
      selectedChangeId = null;
    },
  };
}

export function provideRepositoryLogPane(
  state = createRepositoryLogPane(),
): RepositoryLogPaneState {
  setContext(paneContextKey, state);
  return state;
}

export function useRepositoryLogPane(): RepositoryLogPaneState | undefined {
  return getContext<RepositoryLogPaneState | undefined>(paneContextKey);
}

export function repositoryOverviewTitle(surface: string, name: string): string {
  if (surface === "overview") return name;
  if (surface === "reviews") return "Reviews";
  return surface[0]!.toUpperCase() + surface.slice(1);
}
