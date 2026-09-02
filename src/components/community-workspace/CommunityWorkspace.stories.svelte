<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor } from "storybook/test";

  import CommunityWorkspaceStoryHarness from "./CommunityWorkspaceStoryHarness.svelte";
  import {
    createChannelStoryModel,
    createForumIndexStoryModel,
    createForumThreadStoryModel,
  } from "./story-fixtures.js";

  const consumerSource = `<script lang="ts">
  import { AppShell, AppShellController } from "@lapismd/design-core/shell";
  import {
    CommunityConversation,
    CommunityNavigation,
    CommunitySwitcher,
    type CommunityWorkspaceModel,
  } from "@lapismd/lapis-community/components";

  let { model }: { model: CommunityWorkspaceModel } = $props();

  const shell = new AppShellController({
    leftWidth: 252,
    rightClosed: true,
    rightWidth: 320,
  });
  const communities = shell.createSidebar("communities", "left", {
    width: 64,
    minWidth: 56,
    maxWidth: 280,
  });
<\/script>

<AppShell.Root controller={shell} mobileBreakpoint={1024} desktopMinMainWidth={480}>
  <AppShell.Sidebar
    side="left"
    sidebarController={communities}
    variant="outer"
    label="Community switcher"
    mobileLabel="Communities"
    resizable={false}
  >
    <AppShell.Sidebar.Body>
      <CommunitySwitcher
        communities={model.communities}
        activeCommunityId={model.activeCommunityId}
      />
    </AppShell.Sidebar.Body>
  </AppShell.Sidebar>

  <AppShell.Sidebar side="left" label="Community navigation" mobileLabel="Rooms">
    <AppShell.Sidebar.Header>
      <AppShell.Sidebar.Toggle
        side="left"
        sidebarController={communities}
        sidebarName="communities"
      />
      <strong>Lapis Community</strong>
    </AppShell.Sidebar.Header>
    <AppShell.Sidebar.Body>
      <CommunityNavigation
        sections={model.navigationSections}
        activeRoomId={model.activeRoomId}
      />
    </AppShell.Sidebar.Body>
  </AppShell.Sidebar>

  <AppShell.Main>
    <AppShell.Toolbar>
      <AppShell.Sidebar.Toggle side="left" sidebarName="navigation" />
      <strong># general</strong>
    </AppShell.Toolbar>
    <AppShell.Body layout="regions">
      <AppShell.Body.Content>
        <CommunityConversation
          room={model.navigationSections[0].rooms[0]}
          messages={model.messages}
          members={model.members}
        />
      </AppShell.Body.Content>
    </AppShell.Body>
  </AppShell.Main>

  <AppShell.Sidebar side="right" label="Thread sidebar" closeable>
    <AppShell.Sidebar.Header>
      <strong>Thread</strong>
      <AppShell.Sidebar.Close />
    </AppShell.Sidebar.Header>
  </AppShell.Sidebar>
</AppShell.Root>`;

  const { Story } = defineMeta({
    title: "Community/App Shell",
    component: CommunityWorkspaceStoryHarness,
    tags: ["visual-pending"],
    parameters: {
      layout: "fullscreen",
      docs: {
        story: { inline: false, iframeHeight: 700 },
        source: { language: "svelte", code: consumerSource },
        description: {
          component:
            "A fixture-only demonstration that composes Design Core App Shell directly. Lapis Community exports the room, message, topic, and details components and normalized models, but does not export a parallel shell abstraction.",
        },
      },
    },
  });
</script>

<Story
  name="Desktop channel"
  args={{ initialModel: createChannelStoryModel(), initialWidth: 1280 }}
/>

<Story
  name="Channel thread open"
  args={{
    initialModel: createChannelStoryModel("thread"),
    initialWidth: 1280,
  }}
/>

<Story
  name="Forum topic index"
  args={{ initialModel: createForumIndexStoryModel(), initialWidth: 1280 }}
/>

<Story
  name="Long-form forum thread"
  args={{ initialModel: createForumThreadStoryModel(), initialWidth: 1280 }}
/>

<Story
  name="Compact desktop navigation"
  args={{
    initialModel: createChannelStoryModel(),
    initialWidth: 1120,
    initialNavigationCollapsed: true,
  }}
/>

<Story
  name="Mobile navigation"
  args={{ initialModel: createChannelStoryModel(), initialWidth: 390 }}
  play={async ({ canvas }) => {
    const root = canvas
      .getByTestId("community-workspace-frame")
      .querySelector("[data-shell-root]");
    await expect(root).toHaveAttribute("data-display-mode", "mobile");
    await userEvent.click(
      canvas.getByRole("button", { name: "Open navigation sidebar" }),
    );
    await expect(root).toHaveAttribute("data-mobile-stage", "left");
    await expect(
      canvas.getByRole("button", { name: "Choose left sidebar panel" }),
    ).toBeVisible();
  }}
/>

<Story
  name="Responsive shell contract"
  args={{ initialModel: createChannelStoryModel(), initialWidth: 1280 }}
  play={async ({ canvas }) => {
    const frame = canvas.getByTestId("community-workspace-frame");
    const root = frame.querySelector<HTMLElement>("[data-shell-root]");
    if (!root) throw new Error("Expected the Design Core App Shell root");

    await expect(root).toHaveAttribute("data-display-mode", "desktop");
    const navigationToggle = canvas.getByRole("button", {
      name: "Collapse navigation sidebar",
    });
    await userEvent.click(navigationToggle);
    await expect(
      canvas.getByRole("button", { name: "Expand navigation sidebar" }),
    ).toBeVisible();

    frame.style.setProperty("--community-workspace-story-width", "1100px");
    await waitFor(() =>
      expect(root).toHaveAttribute("data-display-mode", "desktop"),
    );

    frame.style.setProperty("--community-workspace-story-width", "390px");
    await waitFor(() =>
      expect(root).toHaveAttribute("data-display-mode", "mobile"),
    );
    const mobileNavigationToggle = canvas.getByRole("button", {
      name: "Open navigation sidebar",
    });
    mobileNavigationToggle.focus();
    await userEvent.click(mobileNavigationToggle);
    await expect(root).toHaveAttribute("data-mobile-stage", "left");
    await expect(
      canvas.getByRole("button", { name: "Choose left sidebar panel" }),
    ).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect(root).toHaveAttribute("data-mobile-stage", "main");
    await expect(mobileNavigationToggle).toHaveFocus();

    const details = canvas.getByRole("button", { name: "Details" });
    details.focus();
    await userEvent.click(details);
    await expect(root).toHaveAttribute("data-mobile-stage", "right");
    await userEvent.keyboard("{Escape}");
    await expect(root).toHaveAttribute("data-mobile-stage", "main");
    await expect(details).toHaveFocus();

    frame.style.setProperty("--community-workspace-story-width", "1280px");
    await waitFor(() =>
      expect(root).toHaveAttribute("data-display-mode", "desktop"),
    );
    await expect(
      canvas.getByRole("button", { name: "Expand navigation sidebar" }),
    ).toBeVisible();
  }}
/>

<Story
  name="Interactive community flow"
  args={{ initialModel: createChannelStoryModel(), initialWidth: 1280 }}
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Collapse communities sidebar" }),
    );
    await expect(
      canvas.getByRole("button", { name: "Expand communities sidebar" }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Expand communities sidebar" }),
    );

    await userEvent.click(
      canvas.getByRole("button", { name: "3 reactions with 🚀" }),
    );
    await expect(
      canvas.getByRole("button", { name: "4 reactions with 🚀" }),
    ).toBeVisible();

    const composer = canvas.getByRole("combobox", { name: "Message" });
    await userEvent.type(composer, "A fixture-only message");
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByText("A fixture-only message")).toBeVisible();

    await userEvent.click(canvas.getByRole("button", { name: /8 replies/ }));
    await expect(canvas.getByLabelText("Thread sidebar")).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Close right sidebar" }),
    );
    await expect(canvas.queryByLabelText("Thread sidebar")).toBeNull();

    await userEvent.click(canvas.getByRole("button", { name: /support-ai/ }));
    await expect(
      canvas.getByRole("heading", { name: "support-ai" }),
    ).toBeVisible();

    await userEvent.click(
      canvas.getByRole("button", {
        name: "Open topic First-token latency with a large vault",
      }),
    );
    await expect(
      canvas.getByText(/profiling first-token latency with vaults/),
    ).toBeVisible();
  }}
/>
