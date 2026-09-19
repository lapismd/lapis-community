<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import SearchIcon from "@lucide/svelte/icons/search";

  let {
    scope,
    canNavigateBack,
    onHistoryBack,
    onCloseRepository,
    onBackToProjects,
    onSearch,
  }: {
    scope: "overview" | "project" | "repository";
    canNavigateBack: boolean;
    onHistoryBack: () => void;
    onCloseRepository: () => void;
    onBackToProjects: () => void;
    onSearch: () => void;
  } = $props();

  function goBack(): void {
    if (canNavigateBack) {
      onHistoryBack();
      return;
    }
    if (scope === "repository") onCloseRepository();
    else onBackToProjects();
  }
</script>

{#if scope === "overview"}
  <Button
    type="button"
    variant="ghost"
    size="icon-sm"
    class="community-application__project-toolbar-search"
    aria-label="Search projects"
    title="Search projects"
    onclick={onSearch}
  >
    <SearchIcon aria-hidden="true" />
  </Button>
{:else}
  <Button
    type="button"
    variant="ghost"
    size="icon-sm"
    class="community-application__project-toolbar-back"
    aria-label="Back"
    title="Back"
    onclick={goBack}
  >
    <ArrowLeftIcon aria-hidden="true" />
  </Button>
{/if}
