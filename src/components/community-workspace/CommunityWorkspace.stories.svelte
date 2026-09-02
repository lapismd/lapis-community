<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor, within } from "storybook/test";

  import CommunityWorkspaceStoryHarness from "./CommunityWorkspaceStoryHarness.svelte";
  import { createChannelStoryModel } from "./story-fixtures.js";

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
  play={async ({ canvas }) => {
    const frame = canvas.getByTestId("community-workspace-frame");

    await expect(
      canvas.getByRole("heading", { name: "#general" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Browse channels" }),
    ).toBeVisible();

    await userEvent.click(
      canvas.getByRole("button", { name: "3 reactions with 🚀" }),
    );
    await expect(
      canvas.getByRole("button", { name: "4 reactions with 🚀" }),
    ).toHaveAttribute("aria-pressed", "true");

    const composer = canvas.getByRole("combobox", { name: "Message" });
    await userEvent.type(composer, "A channel interaction fixture");
    await userEvent.keyboard("{Enter}");
    await expect(
      canvas.getByText("A channel interaction fixture"),
    ).toBeVisible();
    await expect(frame).toHaveAttribute("data-last-action", "sent-message");

    await userEvent.click(
      canvas.getByRole("button", { name: "Manage channel" }),
    );
    await expect(
      await canvas.findByLabelText("Channel settings sidebar"),
    ).toBeVisible();
    await expect(frame).toHaveAttribute("data-last-action", "opened-details");
    await userEvent.click(
      canvas.getByRole("button", { name: "Close channel settings" }),
    );
    await waitFor(() => {
      expect(canvas.queryByLabelText("Channel settings sidebar")).toBeNull();
    });
  }}
/>

<Story
  name="Channel thread open"
  args={{
    initialModel: createChannelStoryModel("thread"),
    initialWidth: 1280,
  }}
  play={async ({ canvas }) => {
    const frame = canvas.getByTestId("community-workspace-frame");
    const threadSidebar = canvas.getByLabelText("Thread sidebar");
    const thread = within(threadSidebar);

    await expect(threadSidebar).toBeVisible();
    await expect(thread.getByText("Thread")).toBeVisible();
    const composer = thread.getByRole("combobox", { name: "Message" });
    await userEvent.type(composer, "A thread interaction fixture");
    await userEvent.keyboard("{Enter}");
    await expect(
      thread.getByText("A thread interaction fixture"),
    ).toBeVisible();
    await expect(frame).toHaveAttribute("data-last-action", "sent-reply");

    await userEvent.click(
      thread.getByRole("button", { name: "Close right sidebar" }),
    );
    await waitFor(() => {
      expect(canvas.queryByLabelText("Thread sidebar")).toBeNull();
    });
    await expect(frame).toHaveAttribute(
      "data-last-action",
      "closed-side-panel",
    );
  }}
/>
