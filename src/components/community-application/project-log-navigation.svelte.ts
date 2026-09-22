import { untrack } from "svelte";
import {
  createRepositoryLogPane,
  provideRepositoryLogPane,
} from "../../projects/repository-log-pane.svelte.js";
import type { CommunityApplicationLocation } from "./navigation.js";
import { logPaneNavigation, repositoryLogRoute } from "./project-log-route.js";

export function provideProjectLogNavigation(
  location: () => CommunityApplicationLocation,
  navigate: (location: CommunityApplicationLocation) => void,
) {
  const pane = provideRepositoryLogPane(
    createRepositoryLogPane(logPaneNavigation(location, navigate)),
  );
  $effect(() => {
    const route = repositoryLogRoute(location());
    if (route && pane.pane !== route.surface)
      untrack(() => pane.selectPane(route.surface));
  });
  return pane;
}
