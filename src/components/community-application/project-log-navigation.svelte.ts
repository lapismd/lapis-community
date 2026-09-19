import { untrack } from "svelte";
import {
  createRepositoryLogPane,
  provideRepositoryLogPane,
} from "../../projects/repository-log-pane.svelte.js";
import type { CommunityApplicationLocation } from "./navigation.js";

/** Keep the Log renderer independent of application and browser routing. */
export function provideProjectLogNavigation(
  location: () => CommunityApplicationLocation,
  navigate: (location: CommunityApplicationLocation) => void,
) {
  const pane = provideRepositoryLogPane(
    createRepositoryLogPane({
      requestedCommitId() {
        const route = location().projectRoute;
        return route?.kind === "repository" && route.surface === "log"
          ? (route.commitSha ?? null)
          : undefined;
      },
      onSelectCommit(commitId) {
        const current = location();
        const route = current.projectRoute;
        if (route?.kind !== "repository" || route.surface !== "log") return;
        if ((route.commitSha ?? null) === commitId) return;
        const { commitSha: _previous, ...base } = route;
        navigate({
          ...current,
          projectRoute: {
            ...base,
            ...(commitId ? { commitSha: commitId } : {}),
          },
        });
      },
    }),
  );
  $effect(() => {
    const route = location().projectRoute;
    if (route?.kind === "repository" && route.surface === "log")
      untrack(() => pane.selectPane("log"));
  });
  return pane;
}
