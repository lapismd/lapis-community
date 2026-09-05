<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { AppShell, AppShellController } from "@lapismd/design-core/shell";
  import { expect, waitFor } from "storybook/test";

  import CommunityAppShell from "./CommunityAppShell.svelte";

  const controller = new AppShellController({
    rightClosed: true,
    rightWidth: 320,
  });

  const consumerSource = `<script lang="ts">
  import { AppShell, AppShellController } from "@lapismd/design-core/shell";
  import { CommunityAppShell } from "@lapismd/lapis-community/components";

  const shell = new AppShellController({ rightClosed: true });
<\/script>

<CommunityAppShell controller={shell}>
  <AppShell.Sidebar side="left">Navigation</AppShell.Sidebar>
  <AppShell.Main>Workspace</AppShell.Main>
  <AppShell.Sidebar side="right" label="Details" closeable>
    Details
  </AppShell.Sidebar>
</CommunityAppShell>`;

  const { Story } = defineMeta({
    title: "Community/Examples/App Shell",
    component: CommunityAppShell,
    tags: ["visual-pending"],
    globals: { viewport: { value: "desktop", isRotated: false } },
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

<style>
  .community-app-shell-story__navigation,
  .community-app-shell-story__main,
  .community-app-shell-story__details {
    display: grid;
    height: 100%;
    place-items: center;
    color: var(--muted-foreground);
  }
</style>
