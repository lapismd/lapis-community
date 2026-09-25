<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { AppShell } from "@lapismd/design-core/shell";
  import RefreshIcon from "@lucide/svelte/icons/refresh-cw";
  import CommunityApplicationMobileNavigation from "./CommunityApplicationMobileNavigation.svelte";

  interface MobileNavigationModel {
    canNavigateBack: boolean;
    canNavigateForward: boolean;
    navigate: (delta: -1 | 1) => void;
  }

  interface AgentsToolbarState {
    status: string;
  }

  interface AgentsToolbarActions {
    refresh: () => void | Promise<void>;
  }

  interface Props {
    mobile: boolean;
    navigationCompact: boolean;
    mobileNavigationModel: MobileNavigationModel;
    agentsState: AgentsToolbarState | undefined;
    agentsActions: AgentsToolbarActions | undefined;
  }

  let {
    mobile,
    navigationCompact,
    mobileNavigationModel,
    agentsState,
    agentsActions,
  }: Props = $props();
</script>

<AppShell.Toolbar
  label="Agents page header"
  class="community-application__agents-toolbar"
>
  <div class="community-application__toolbar-start">
    {#if mobile}
      <CommunityApplicationMobileNavigation model={mobileNavigationModel} />
    {:else if navigationCompact}
      <AppShell.Sidebar.Toggle side="left" sidebarName="navigation" />
    {/if}
    <h1 class="community-application__toolbar-title">Agents</h1>
  </div>
  <div class="community-application__toolbar-actions">
    {#if agentsActions}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Refresh agents"
        title="Refresh agents"
        disabled={agentsState === undefined || agentsState.status === "loading"}
        onclick={() => void agentsActions.refresh()}
      >
        <RefreshIcon aria-hidden="true" />
      </Button>
    {/if}
  </div>
</AppShell.Toolbar>

<style>
  .community-application__toolbar-start,
  .community-application__toolbar-actions {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.5rem;
  }

  .community-application__toolbar-title {
    margin: 0;
    font-size: var(--community-text-section);
    font-weight: 650;
    line-height: 1.35;
  }
</style>
