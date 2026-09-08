<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { AppShell, AppShellController } from "@lapismd/design-core/shell";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { expect, userEvent, waitFor, within } from "storybook/test";

  import CommunityAppShell from "./CommunityAppShell.svelte";

  const controller = new AppShellController({
    rightClosed: true,
    rightWidth: 320,
  });
  const compositionShell = new AppShellController({
    leftWidth: 224,
    rightClosed: false,
    rightWidth: 288,
  });
  const compositionActivity = compositionShell.createSidebar(
    "activity-overview",
    "right",
    {
      closed: false,
      width: 224,
      minWidth: 192,
      maxWidth: 320,
    },
  );

  const consumerSource = `<script lang="ts">
  import { AppShell, AppShellController } from "@lapismd/design-core/shell";
  import { CommunityAppShell } from "@lapismd/lapis-community/components";

  const shell = new AppShellController({ rightClosed: false });
  const activity = shell.createSidebar("activity-overview", "right", {
    width: 224,
  });
  let layerOpen = $state(false);
<\/script>

<CommunityAppShell controller={shell}>
  <AppShell.Sidebar side="left">Navigation</AppShell.Sidebar>
  <AppShell.Main>Workspace</AppShell.Main>
  <AppShell.Sidebar
    side="right"
    constraintPriority={0}
    constrainedPresentation="replace-main"
    label="Details"
  >
    Details
  </AppShell.Sidebar>
  <AppShell.Sidebar
    side="right"
    sidebarController={activity}
    variant="rail"
    constraintPriority={100}
    label="Activity overview"
  >
    <button onclick={() => (layerOpen = true)}>Activity</button>
  </AppShell.Sidebar>
  <AppShell.SurfaceLayer
    open={layerOpen}
    label="Activity"
    coverPanelIds={["right"]}
    suspendPanelIds={["activity-overview"]}
    onDismiss={() => (layerOpen = false)}
  >
    <AppShell.SurfaceLayer.Header>Activity</AppShell.SurfaceLayer.Header>
    <AppShell.SurfaceLayer.Body>Recent activity</AppShell.SurfaceLayer.Body>
  </AppShell.SurfaceLayer>
</CommunityAppShell>`;

  const { Story } = defineMeta({
    title: "Community/Examples/App Shell",
    component: CommunityAppShell,
    tags: ["visual-pending"],
    parameters: {
      layout: "fullscreen",
      communityAppShell: true,
      docs: {
        source: { language: "svelte", code: consumerSource },
        description: {
          component:
            "The production frame shared by full community workspaces and shell-backed component previews.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let compositionLayerOpen = $state(false);
</script>

<Story
  name="Shell frame contract"
  play={async ({ canvas }) => {
    controller.right.expand();
    controller.right.collapse();
    await waitFor(() => expect(controller.right.state).toBe("expanded"));
    await expect(canvas.getByLabelText("Details")).toHaveAttribute(
      "data-state",
      "expanded",
    );
  }}
>
  {#snippet template()}
    <CommunityAppShell
      {controller}
      displayMode="desktop"
      desktopMinMainWidth={0}
    >
      <AppShell.Sidebar side="left" label="Community navigation sidebar">
        <div class="community-app-shell-story__navigation">Navigation</div>
      </AppShell.Sidebar>
      <AppShell.Main>
        <div class="community-app-shell-story__main">Workspace</div>
      </AppShell.Main>
      <AppShell.Sidebar side="right" label="Details" closeable>
        <div class="community-app-shell-story__details">Details</div>
      </AppShell.Sidebar>
    </CommunityAppShell>
  {/snippet}
</Story>

<Story
  name="Composable right panels and surface layer"
  play={async ({ canvas }) => {
    const settings = canvas.getByRole("complementary", {
      name: "Project settings",
    });
    const activity = canvas.getByRole("complementary", {
      name: "Activity overview",
    });
    await expect(settings).toBeVisible();
    await expect(activity).toBeVisible();

    await userEvent.click(
      within(activity).getByRole("button", { name: "Open activity" }),
    );
    await expect(
      await canvas.findByRole("region", { name: "Activity" }),
    ).toBeVisible();
    await expect(activity).not.toBeVisible();
    await expect(settings).toHaveAttribute("aria-hidden", "true");

    await userEvent.click(
      canvas.getByRole("button", { name: "Back to project overview" }),
    );
    await waitFor(() =>
      expect(canvas.queryByRole("region", { name: "Activity" })).toBeNull(),
    );
    await expect(settings).toBeVisible();
    await expect(activity).toBeVisible();
  }}
>
  {#snippet template()}
    {#snippet headerEnd()}
      <AppShell.Sidebar.Toggle
        shellController={compositionShell}
        side="right"
        sidebarController={compositionActivity}
        sidebarName="activity overview"
      />
    {/snippet}

    <CommunityAppShell
      controller={compositionShell}
      displayMode="desktop"
      desktopMinMainWidth={560}
      {headerEnd}
    >
      <AppShell.Sidebar side="left" label="Project navigation">
        <AppShell.Sidebar.Header
          ><strong>Project</strong></AppShell.Sidebar.Header
        >
        <AppShell.Sidebar.Body>
          <nav class="composition-story__navigation" aria-label="Project pages">
            <a href="#overview">Overview</a>
            <a href="#documents">Documents</a>
          </nav>
        </AppShell.Sidebar.Body>
      </AppShell.Sidebar>

      <AppShell.Main>
        <AppShell.Toolbar label="Project toolbar">
          <strong>Project overview</strong>
        </AppShell.Toolbar>
        <AppShell.Body layout="regions">
          <AppShell.Body.Content>
            <div class="composition-story__main">
              <h1>Project overview</h1>
              <p>
                The main workspace remains mounted beneath structural layers.
              </p>
            </div>
          </AppShell.Body.Content>
        </AppShell.Body>
      </AppShell.Main>

      <AppShell.Sidebar
        side="right"
        constraintPriority={0}
        constrainedPresentation="replace-main"
        label="Project settings"
        closeable
      >
        <AppShell.Sidebar.Header>
          <strong>Project settings</strong>
          <AppShell.Sidebar.Close />
        </AppShell.Sidebar.Header>
        <AppShell.Sidebar.Body>
          <div class="composition-story__panel-copy">
            Sharing and permissions
          </div>
        </AppShell.Sidebar.Body>
      </AppShell.Sidebar>

      <AppShell.Sidebar
        side="right"
        sidebarController={compositionActivity}
        variant="rail"
        constraintPriority={100}
        label="Activity overview"
      >
        <AppShell.Sidebar.Body>
          <nav
            class="composition-story__activity"
            aria-label="Activity overview"
          >
            <Button
              variant="ghost"
              onclick={() => (compositionLayerOpen = true)}
            >
              Open activity
            </Button>
            <Button variant="ghost">People <small>4</small></Button>
          </nav>
        </AppShell.Sidebar.Body>
      </AppShell.Sidebar>

      <AppShell.SurfaceLayer
        open={compositionLayerOpen}
        label="Activity"
        coverPanelIds={["right"]}
        suspendPanelIds={["activity-overview"]}
        dismissLabel="Back to project overview"
        onDismiss={() => (compositionLayerOpen = false)}
      >
        <AppShell.SurfaceLayer.Header>
          <strong>Activity</strong>
          <Button
            variant="ghost"
            size="sm"
            onclick={() => (compositionLayerOpen = false)}>Close</Button
          >
        </AppShell.SurfaceLayer.Header>
        <AppShell.SurfaceLayer.Body>
          <div class="composition-story__layer-copy">
            A structural surface can cover the main workspace and selected
            panels.
          </div>
        </AppShell.SurfaceLayer.Body>
      </AppShell.SurfaceLayer>
    </CommunityAppShell>
  {/snippet}
</Story>

<style>
  .community-app-shell-story__navigation,
  .community-app-shell-story__main,
  .community-app-shell-story__details {
    display: grid;
    height: 100%;
    place-items: center;
    color: var(--muted-foreground);
  }

  .composition-story__navigation,
  .composition-story__activity {
    display: grid;
    gap: 0.25rem;
    padding: 0.75rem;
  }

  .composition-story__navigation a {
    padding: 0.5rem;
    border-radius: var(--radius-md);
    color: inherit;
    text-decoration: none;
  }

  .composition-story__activity :global([data-ui-component="button"]) {
    justify-content: space-between;
  }

  .composition-story__activity small {
    color: var(--muted-foreground);
  }

  .composition-story__main,
  .composition-story__panel-copy,
  .composition-story__layer-copy {
    padding: 1rem;
  }

  .composition-story__main h1,
  .composition-story__main p {
    margin: 0;
  }

  .composition-story__main p {
    margin-block-start: 0.5rem;
    color: var(--muted-foreground);
  }
</style>
