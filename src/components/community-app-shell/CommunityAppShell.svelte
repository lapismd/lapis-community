<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import {
    AppShell,
    type AppShellController,
    type AppShellDisplayMode,
  } from "@lapismd/design-core/shell";
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import type { Snippet } from "svelte";
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
    children?: Snippet;
  } = $props();
</script>

<div
  {...restProps}
  class={["community-app-shell", className].filter(Boolean).join(" ")}
  data-ui-component="community-app-shell"
>
  <header
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
        <rect x="4" y="5" width="2" height="14" rx="2" fill="currentColor"
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
  </header>

  <AppShell.Root
    {controller}
    {displayMode}
    {mobileBreakpoint}
    {...desktopMinMainWidth === undefined ? {} : { desktopMinMainWidth }}
    class="community-app-shell__surface"
  >
    {@render children?.()}
  </AppShell.Root>
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

  :global(.community-app-shell__surface) {
    --ui-shell-height: 100%;
    --ui-shell-right-sidebar-gap: 0;

    border: 0;
    border-radius: 0;
    box-shadow: none;
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
