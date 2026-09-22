<script lang="ts">
  import "../community-overlays.css";
  import "./right-sidebar.css";

  import { Button } from "@lapismd/design-core/shadcn/button";
  import {
    AppShell,
    type AppShellController,
    type AppShellDisplayMode,
  } from "@lapismd/design-core/shell";
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";

  import CommunitySidebarToggleIcon from "./CommunitySidebarToggleIcon.svelte";
  import { untrack, type Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  let {
    controller,
    displayMode = "auto",
    mobileBreakpoint = 1024,
    desktopMinMainWidth,
    canNavigateBack = false,
    canNavigateForward = false,
    onNavigateBack,
    onNavigateForward,
    headerCenter,
    headerEnd,
    class: className,
    children,
    ...restProps
  }: HTMLAttributes<HTMLDivElement> & {
    controller: AppShellController;
    displayMode?: AppShellDisplayMode;
    mobileBreakpoint?: number;
    desktopMinMainWidth?: number;
    canNavigateBack?: boolean;
    canNavigateForward?: boolean;
    onNavigateBack?: () => void;
    onNavigateForward?: () => void;
    headerCenter?: Snippet;
    headerEnd?: Snippet;
    children?: Snippet;
  } = $props();

  let shellSurface = $state<HTMLDivElement | null>(null);
  let headerMainStart = $state(0);
  let headerMainWidth = $state(0);
  const mobileMode = $derived(controller.mobile.resolvedMode === "mobile");

  $effect(() => {
    const surface = shellSurface;
    if (!surface || mobileMode) return;
    const main = surface.querySelector<HTMLElement>('[data-ui-part="main"]');
    if (!main) return;
    const updateHeaderMainStart = () => {
      const surfaceBounds = surface.getBoundingClientRect();
      const mainBounds = main.getBoundingClientRect();
      headerMainStart = Math.max(
        0,
        Math.round(mainBounds.left - surfaceBounds.left),
      );
      headerMainWidth = Math.max(0, Math.round(mainBounds.width));
    };
    updateHeaderMainStart();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateHeaderMainStart);
    observer.observe(surface);
    observer.observe(main);
    return () => observer.disconnect();
  });

  $effect(() => {
    const rightSidebar = controller.right;
    const preventCollapsedRightSidebar = () => {
      if (!rightSidebar.collapsed) return;
      const wasClosed = rightSidebar.closed;
      rightSidebar.expand();
      if (wasClosed) rightSidebar.close();
    };

    untrack(preventCollapsedRightSidebar);
    return rightSidebar.onLayoutChange(preventCollapsedRightSidebar);
  });

  $effect(() => {
    const stage = controller.mobile.stage;
    if (!mobileMode || !shellSurface) return;
    queueMicrotask(() => {
      if (
        controller.mobile.resolvedMode !== "mobile" ||
        controller.mobile.stage !== stage
      ) {
        return;
      }
      const mobileStage = shellSurface?.querySelector<HTMLElement>(
        '[data-ui-part="mobile-stage"]',
      );
      if (mobileStage) mobileStage.scrollLeft = 0;
    });
  });
</script>

<div
  {...restProps}
  class={["community-app-shell", className].filter(Boolean).join(" ")}
  data-ui-component="community-app-shell"
  data-display-mode={controller.mobile.resolvedMode}
>
  {#if !mobileMode}
    <nav
      class="community-app-shell__header"
      aria-label="Application navigation"
      style={`--community-app-shell-header-main-start: ${headerMainStart}px; --community-app-shell-header-main-width: ${headerMainWidth}px`}
    >
      <div class="community-app-shell__header-start">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={controller.left.collapsed
            ? "Expand left sidebar"
            : "Collapse left sidebar"}
          aria-expanded={!controller.left.collapsed}
          data-ui-part="sidebar-toggle"
          data-side="left"
          data-state={controller.left.collapsed ? "collapsed" : "expanded"}
          title={controller.left.collapsed
            ? "Expand left sidebar"
            : "Collapse left sidebar"}
          onclick={() => controller.left.toggle()}
        >
          <CommunitySidebarToggleIcon expanded={!controller.left.collapsed} />
        </Button>

        <div
          class="community-app-shell__history"
          role="group"
          aria-label="Navigation history"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Back"
            title="Back"
            disabled={!canNavigateBack}
            onclick={() => onNavigateBack?.()}
          >
            <ChevronLeftIcon aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Forward"
            title="Forward"
            disabled={!canNavigateForward}
            onclick={() => onNavigateForward?.()}
          >
            <ChevronRightIcon aria-hidden="true" />
          </Button>
        </div>
      </div>

      {#if headerCenter}
        <div class="community-app-shell__header-center">
          {@render headerCenter()}
        </div>
      {/if}

      {#if headerEnd}
        <div class="community-app-shell__header-end">
          {@render headerEnd()}
        </div>
      {/if}
    </nav>
  {/if}

  <div class="community-app-shell__stage">
    <AppShell.Root
      bind:ref={shellSurface}
      {controller}
      {displayMode}
      {mobileBreakpoint}
      {...desktopMinMainWidth === undefined ? {} : { desktopMinMainWidth }}
      class="community-app-shell__surface"
    >
      {@render children?.()}
    </AppShell.Root>
  </div>
</div>

<style>
  .community-app-shell {
    box-sizing: border-box;
    display: grid;
    width: 100%;
    min-width: 0;
    height: 100%;
    min-height: 0;
    grid-template-rows: 2.5rem minmax(0, 1fr);
    overflow: hidden;
    color: var(--foreground);
    background: var(--muted);
  }

  .community-app-shell[data-display-mode="mobile"] {
    grid-template-rows: minmax(0, 1fr);
  }

  .community-app-shell__header {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0;
    padding-inline-end: 0.75rem;
    background: var(--sidebar, var(--muted));
  }

  .community-app-shell__header-start {
    display: flex;
    box-sizing: border-box;
    align-items: center;
    gap: 0.125rem;
    padding-inline-start: 0.5rem;
  }

  .community-app-shell__history {
    display: flex;
    align-items: center;
    gap: 0.125rem;
  }

  .community-app-shell__header-center {
    position: absolute;
    inset-inline-start: var(--community-app-shell-header-main-start);
    display: flex;
    width: var(--community-app-shell-header-main-width);
    min-width: 0;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    padding-inline: 1.25rem;
    overflow: hidden;
  }

  .community-app-shell__header-end {
    display: flex;
    align-items: center;
    margin-inline-start: auto;
  }

  .community-app-shell__stage {
    position: relative;
    display: flex;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  :global(.community-app-shell__surface) {
    --ui-shell-height: 100%;
    --ui-shell-right-sidebar-gap: 0;

    width: auto;
    flex: 1;
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }

  :global(.community-app-shell__surface [data-ui-part="toolbar"]) {
    padding-inline: 1rem;
    border-block-end: 0;
  }

  :global(
      .community-app-shell__surface
        [data-ui-part="sidebar"][data-side="right"]
        > [data-ui-part="sidebar-header"]
    ) {
    display: flex;
    min-height: calc(
      var(--ui-shell-toolbar-height) - var(--ui-shell-main-block-inset) - 1px
    );
    align-items: center;
    gap: 0.5rem;
    padding-inline: 0.75rem;
    border-block-end: 0;
  }

  :global(
      .community-app-shell__surface
        [data-ui-part="sidebar"][data-side="right"]
        > [data-ui-part="sidebar-header"]
        > strong
    ) {
    min-width: 0;
    flex: 1;
  }

  :global(
      .community-app-shell__surface [data-ui-part="sidebar-header"] > strong
    ) {
    font-size: var(--community-text-body);
  }

  @media (hover: hover) {
    :global(
        .community-app-shell__header
          [data-ui-component="button"]:not(:disabled):hover
      ) {
      color: var(--sidebar-accent-foreground, var(--accent-foreground));
      background: var(--sidebar-accent, var(--accent));
    }

    @supports (color: color-mix(in oklab, black, white)) {
      :global(
          .community-app-shell__header
            [data-ui-component="button"]:not(:disabled):hover
        ) {
        background: color-mix(
          in oklab,
          var(--sidebar-accent, var(--accent)) 92%,
          var(--sidebar-accent-foreground, var(--accent-foreground))
        );
      }
    }
  }

</style>
