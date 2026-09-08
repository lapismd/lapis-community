<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import {
    AppShell,
    type AppShellController,
    type AppShellDisplayMode,
  } from "@lapismd/design-core/shell";
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
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
    headerEnd,
    overlay,
    overlayMainAllowance = 0,
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
    headerEnd?: Snippet;
    overlay?: Snippet;
    overlayMainAllowance?: number;
    children?: Snippet;
  } = $props();

  let shellSurface = $state<HTMLDivElement | null>(null);
  let surfaceStage = $state<HTMLDivElement | null>(null);
  let overlayInsetInlineStart = $state(0);
  let overlayInsetBlockStart = $state(0);
  let overlayInsetBlockEnd = $state(0);
  const mobileMode = $derived(controller.mobile.resolvedMode === "mobile");

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
    if (!overlay || !surfaceStage || !shellSurface) return;
    const updateOverlayInset = () => {
      const main = shellSurface?.querySelector<HTMLElement>(
        '[data-ui-part="main"]',
      );
      if (!main || !surfaceStage) return;
      const stageBounds = surfaceStage.getBoundingClientRect();
      const mainBounds = main.getBoundingClientRect();
      overlayInsetInlineStart = Math.max(0, mainBounds.left - stageBounds.left);
      overlayInsetBlockStart = Math.max(0, mainBounds.top - stageBounds.top);
      overlayInsetBlockEnd = Math.max(
        0,
        stageBounds.bottom - mainBounds.bottom,
      );
    };
    updateOverlayInset();
    const observer = new ResizeObserver(updateOverlayInset);
    observer.observe(surfaceStage);
    observer.observe(shellSurface);
    return () => observer.disconnect();
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
    >
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
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <rect x="1" y="2" width="22" height="20" rx="4"></rect>
          <rect
            x="4"
            y="5"
            width={controller.left.collapsed ? 2 : 6}
            height="14"
            rx="2"
            fill="currentColor"
            data-ui-part="sidebar-toggle-indicator"
          ></rect>
        </svg>
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

      {#if headerEnd}
        <div class="community-app-shell__header-end">
          {@render headerEnd()}
        </div>
      {/if}
    </nav>
  {/if}

  <div class="community-app-shell__stage" bind:this={surfaceStage}>
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
    {#if overlay}
      <div
        class="community-app-shell__overlay-host"
        style:inset-inline-start={`${overlayInsetInlineStart}px`}
        style:inset-block-start={`${overlayInsetBlockStart}px`}
        style:inset-block-end={`${overlayInsetBlockEnd}px`}
        style:--community-app-shell-overlay-main-allowance={`${Math.max(0, overlayMainAllowance)}px`}
      >
        {@render overlay()}
      </div>
    {/if}
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
    display: flex;
    align-items: center;
    gap: 0.125rem;
    padding-inline: 0.5rem 0.75rem;
    background: var(--sidebar, var(--muted));
  }

  .community-app-shell__history {
    display: flex;
    align-items: center;
    gap: 0.125rem;
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

  .community-app-shell__overlay-host {
    position: absolute;
    z-index: 40;
    inset-inline-end: 0;
    min-width: 0;
    min-height: 0;
    pointer-events: none;
  }

  .community-app-shell__overlay-host > :global(*) {
    pointer-events: auto;
  }

  :global([data-ui-part="sidebar-toggle-indicator"]) {
    width: 2px;
    transition: width 140ms ease;
  }

  :global(
      [data-ui-part="sidebar-toggle"][data-state="expanded"]
        [data-ui-part="sidebar-toggle-indicator"]
    ) {
    width: 6px;
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
    font-size: 0.88rem;
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

  :global(
      .community-app-shell__surface:has(
          > .ui-minimal-app-shell__composition
            > .ui-minimal-app-shell__sidebar[data-side="right"][data-presentation="inline"]:not(
              [hidden]
            )
        )
        > .ui-minimal-app-shell__composition
        > .ui-minimal-app-shell__main
    ) {
    border-start-end-radius: 0;
    border-end-end-radius: 0;
  }

  :global(
      .community-app-shell__surface
        > .ui-minimal-app-shell__composition
        > .ui-minimal-app-shell__sidebar[data-side="right"][data-presentation="inline"]
    ) {
    margin-block: var(--ui-shell-main-block-inset);
    margin-inline-end: var(--ui-shell-main-block-inset);
    border: var(--ui-shell-main-border);
    border-inline-start: 0;
    border-start-end-radius: var(--ui-shell-main-radius);
    border-end-end-radius: var(--ui-shell-main-radius);
    background: var(--background);
    box-shadow: var(--ui-shell-main-shadow);
  }
</style>
