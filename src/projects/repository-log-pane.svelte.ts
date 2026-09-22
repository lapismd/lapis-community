import { getContext, setContext } from "svelte";

export type RepositoryLogPane = "log" | "oplog";

export type RepositoryLogNavigation = {
  requestedCommitId?(): string | null | undefined;
  onSelectCommit?(commitId: string | null): void;
  onSelectPane?(pane: RepositoryLogPane): void;
};

export type RepositoryLogPaneState = {
  readonly pane: RepositoryLogPane;
  readonly evologOpen: boolean;
  readonly selectedCommitId: string | null;
  readonly selectedChangeId: string | null;
  readonly reviewCommitId: string | null;
  readonly reviewEmpty: boolean;
  readonly reviewMessage: string;
  readonly requestedCommitId: string | null | undefined;
  navigateToCommit(commitId: string | null): void;
  selectPane(pane: RepositoryLogPane): void;
  toggleEvolog(): void;
  setEvologOpen(open: boolean): void;
  setLogSelection(
    commitId: string | null,
    changeId: string | null,
    review?: { commitId?: string; empty?: boolean; message?: string },
  ): void;
  reset(): void;
};

const paneContextKey = Symbol("repository-log-pane");

export function createRepositoryLogPane(
  navigation: RepositoryLogNavigation = {},
): RepositoryLogPaneState {
  let pane = $state<RepositoryLogPane>("log");
  let evologOpen = $state(false);
  let selectedCommitId = $state<string | null>(null);
  let selectedChangeId = $state<string | null>(null);
  let reviewCommitId = $state<string | null>(null);
  let reviewEmpty = $state(false);
  let reviewMessage = $state("");

  function selectPane(next: RepositoryLogPane): void {
    const changed = pane !== next;
    pane = next;
    if (next === "oplog") {
      evologOpen = false;
      selectedCommitId = null;
      selectedChangeId = null;
      reviewCommitId = null;
      reviewEmpty = false;
      reviewMessage = "";
    }
    if (changed) navigation.onSelectPane?.(next);
  }

  return {
    get requestedCommitId() {
      return navigation.requestedCommitId?.();
    },
    navigateToCommit(commitId) {
      navigation.onSelectCommit?.(commitId);
    },
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
    get reviewCommitId() {
      return reviewCommitId;
    },
    get reviewEmpty() {
      return reviewEmpty;
    },
    get reviewMessage() {
      return reviewMessage;
    },
    selectPane,
    toggleEvolog(): void {
      this.setEvologOpen(!evologOpen);
    },
    setEvologOpen(open: boolean): void {
      evologOpen = pane === "log" && Boolean(selectedCommitId) && open;
    },
    setLogSelection(commitId, changeId, review): void {
      selectedCommitId = commitId;
      selectedChangeId = changeId;
      reviewCommitId = review?.commitId ?? null;
      reviewEmpty = review?.empty === true;
      reviewMessage = review?.message ?? "";
      if (!commitId) evologOpen = false;
    },
    reset(): void {
      pane = "log";
      evologOpen = false;
      selectedCommitId = null;
      reviewCommitId = null;
      reviewEmpty = false;
      reviewMessage = "";
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
