<script lang="ts">
  import { untrack } from "svelte";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { provideProjectLogNavigation } from "../community-application/project-log-navigation.svelte.js";
  import { projectRouteToHash } from "../community-application/project-route.js";
  import type { CommunityApplicationLocation } from "../community-application/navigation.js";
  import CommunityProjectsRepositoryLog from "./CommunityProjectsRepositoryLog.svelte";
  import { events, merge } from "./repository-log-story-fixtures.js";

  let {
    initialCommit = merge,
    deferHistory = false,
    historyBeforeReady = false,
    historyEvents = events,
  } = $props();
  let location = $state<CommunityApplicationLocation>(
    untrack(() => ({
      destination: "projects",
      panel: { kind: "none" },
      projectRoute: {
        kind: "repository",
        coordinate: "30617:owner:probe",
        surface: "log",
        commitSha: initialCommit,
      },
    })),
  );
  let history = $state<CommunityApplicationLocation[]>([
    untrack(() => location),
  ]);
  let index = $state(0);
  let loaded = $state(!untrack(() => deferHistory));
  provideProjectLogNavigation(
    () => location,
    (next) => {
      history = [...history.slice(0, index + 1), next];
      index += 1;
      location = next;
    },
  );
</script>

<div class="log-navigation-harness">
  <nav aria-label="Test history">
    <Button
      disabled={index === 0}
      onclick={() => {
        index -= 1;
        location = history[index]!;
      }}>Back</Button
    >
    <Button
      disabled={index === history.length - 1}
      onclick={() => {
        index += 1;
        location = history[index]!;
      }}>Forward</Button
    >
    {#if !loaded}<Button
        onclick={() => {
          loaded = true;
        }}>Load history</Button
      >{/if}
    <output aria-label="Log address"
      >{projectRouteToHash(location.projectRoute!)}</output
    >
  </nav>
  <CommunityProjectsRepositoryLog
    events={loaded || historyBeforeReady ? historyEvents : []}
    loading={!loaded}
    repositoryAddress="30617:owner:probe"
    onLoadRepositoryCommit={async (sha) => {
      if (!loaded) throw new Error("Repository source is not ready");
      return {
        commit: { sha, subject: "Selected commit" },
        stats: [{ path: `${sha.slice(0, 8)}.md`, additions: 1, deletions: 0 }],
        patch: "",
      };
    }}
  />
</div>

<style>
  .log-navigation-harness {
    display: flex;
    flex-direction: column;
    height: 40rem;
  }
  nav {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
  }
  output {
    overflow-wrap: anywhere;
  }
</style>
