<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { AppShell } from "@lapismd/design-core/shell";
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";

  interface MobileNavigationModel {
    canNavigateBack: boolean;
    canNavigateForward: boolean;
    navigate: (delta: -1 | 1) => void;
  }

  let { model }: { model: MobileNavigationModel } = $props();
</script>

<div class="community-application__mobile-navigation">
  <AppShell.Sidebar.Toggle side="left" sidebarName="navigation" />
  <div
    class="community-application__mobile-history"
    role="group"
    aria-label="Navigation history"
  >
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Back"
      title="Back"
      disabled={!model.canNavigateBack}
      onclick={() => model.navigate(-1)}
    >
      <ChevronLeftIcon aria-hidden="true" />
    </Button>
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Forward"
      title="Forward"
      disabled={!model.canNavigateForward}
      onclick={() => model.navigate(1)}
    >
      <ChevronRightIcon aria-hidden="true" />
    </Button>
  </div>
</div>

<style>
  .community-application__mobile-navigation,
  .community-application__mobile-history {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.125rem;
  }
</style>
