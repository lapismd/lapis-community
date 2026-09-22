<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import GitCommitHorizontalIcon from "@lucide/svelte/icons/git-commit-horizontal";
  import GitCompareIcon from "@lucide/svelte/icons/git-compare";
  import HistoryIcon from "@lucide/svelte/icons/history";
  import { onDestroy } from "svelte";

  import CommunityEntityCopyButton from "../community-entity-chip/CommunityEntityCopyButton.svelte";
  import { useRepositoryLogPane } from "../../projects/repository-log-pane.svelte.js";

  const pane = useRepositoryLogPane();
  onDestroy(() => pane?.reset());
</script>

{#if pane}
  <nav
    class="community-projects-repository-log-rail"
    aria-label="Repository log views"
  >
    <Button
      type="button"
      variant="ghost"
      class="community-application__project-overview-item"
      data-active={pane.pane === "log" ? "" : undefined}
      aria-current={pane.pane === "log" ? "page" : undefined}
      onclick={() => pane.selectPane("log")}
    >
      <GitCommitHorizontalIcon data-icon="inline-start" aria-hidden="true" />
      <span>Log</span>
    </Button>
    <Button
      type="button"
      variant="ghost"
      class="community-application__project-overview-item"
      data-active={pane.pane === "oplog" ? "" : undefined}
      aria-current={pane.pane === "oplog" ? "page" : undefined}
      onclick={() => pane.selectPane("oplog")}
    >
      <HistoryIcon data-icon="inline-start" aria-hidden="true" />
      <span>Op Log</span>
    </Button>
    <CommunityEntityCopyButton
      success={pane.pane === "oplog" ? "Op Log link copied" : "Log link copied"}
    />
    {#if pane.pane === "log" && pane.selectedCommitId}
      <Button
        type="button"
        variant="ghost"
        class="community-application__project-overview-item"
        aria-pressed={pane.evologOpen}
        onclick={() => pane.toggleEvolog()}
      >
        <GitCompareIcon data-icon="inline-start" aria-hidden="true" />
        <span>Evolog</span>
      </Button>
    {/if}
  </nav>
{/if}

<style>
  .community-projects-repository-log-rail {
    display: grid;
    gap: 0.15rem;
  }

  .community-projects-repository-log-rail
    :global(
      .community-application__project-overview-item[data-ui-component="button"][aria-pressed="true"]
    ) {
    color: var(--foreground);
    background: color-mix(in srgb, var(--muted) 62%, transparent);
  }
</style>
