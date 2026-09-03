<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor, within } from "storybook/test";

  import CommunityAppShell from "../community-app-shell/CommunityAppShell.svelte";
  import CommunityNavigationShellFixture from "../community-navigation/CommunityNavigationShellFixture.svelte";
  import CommunityWorkspaceSurface from "./CommunityWorkspaceSurface.svelte";
  import CommunityWorkspaceStoryHarness from "./CommunityWorkspaceStoryHarness.svelte";
  import { createChannelStoryModel } from "./story-fixtures.js";

  const consumerSource = `<script lang="ts">
  import { AppShell, AppShellController } from "@lapismd/design-core/shell";
  import { onMount } from "svelte";
  import {
    CommunityAppShell,
    CommunityWorkspaceSurface,
  } from "@lapismd/lapis-community/components";
  import {
    createCommunityController,
    createNip29CommunitySource,
  } from "@lapismd/lapis-community/community";
  import { createWebSocketCommunityRelayFactory } from "@lapismd/lapis-community/nostr";

  const shell = new AppShellController({
    rightClosed: true,
    rightWidth: 320,
  });
  const community = createCommunityController({
    scopes: [{
      id: "lapis",
      name: "Lapis Community",
      relayUrl: "wss://relay.example",
      rooms: [{ id: "general", groupId: "general", name: "general", kind: "channel" }],
    }],
    source: createNip29CommunitySource({
      relayFactory: createWebSocketCommunityRelayFactory(),
    }),
  });

  onMount(() => {
    community.initialize();
    return () => community.dispose();
  });
<\/script>

<CommunityAppShell controller={shell}>
  <AppShell.Main>
    <AppShell.Body layout="regions">
      <AppShell.Body.Content>
        <CommunityWorkspaceSurface
          model={community.state.workspace}
          handlers={community.handlers}
        />
      </AppShell.Body.Content>
    </AppShell.Body>
  </AppShell.Main>
</CommunityAppShell>`;

  const { Story } = defineMeta({
    title: "Community/Examples/App Shell",
    component: CommunityAppShell,
    tags: ["visual-pending"],
    parameters: {
      layout: "fullscreen",
      communityAppShell: true,
      docs: {
        story: { inline: false, iframeHeight: 700 },
        source: { language: "svelte", code: consumerSource },
        description: {
          component:
            "Controller-backed Inbox, channel, and thread examples. Each story uses an isolated in-memory relay by default and can use the Docker WebSocket relay from the toolbar when VITE_COMMUNITY_RELAY_URL is configured.",
        },
      },
    },
  });
</script>

<Story
  name="Inbox"
  play={async ({ canvas, canvasElement }) => {
    const document = canvasElement.ownerDocument;
    const storybookRoot =
      document.querySelector<HTMLElement>("#storybook-root");
    const leftSidebar = canvas.getByLabelText("Left sidebar");
    const mainBody = canvas.getByRole("main", { name: "Inbox workspace" });
    const shellRoot = leftSidebar.closest<HTMLElement>("[data-shell-root]");
    const inboxList = canvas.getByLabelText("Inbox conversations");
    const thread = canvas.getByRole("region", {
      name: "Selected inbox thread",
    });
    const runtime = canvas.getByTestId("community-navigation-runtime");

    await waitFor(() => {
      expect(runtime).toHaveAttribute("data-community-status", "connected");
    });
    if (runtime.dataset.communityBackend === "live") return;

    await expect(leftSidebar).toHaveAttribute("data-state", "expanded");
    await expect(canvas.queryByLabelText("Right sidebar")).toBeNull();
    await expect(
      canvas.queryByRole("button", { name: /right sidebar/i }),
    ).toBeNull();
    await expect(
      canvas.getByRole("searchbox", { name: "Search community" }),
    ).toBeVisible();
    await expect(canvas.getByRole("button", { name: "general" })).toBeVisible();
    await expect(
      within(inboxList).getByText("Hello from a member"),
    ).toBeVisible();
    await expect(
      canvas.getByRole("heading", { name: "support" }),
    ).toBeVisible();
    await expect(inboxList).toBeVisible();
    await expect(thread).toBeVisible();
    await expect(
      canvas.getByRole("combobox", { name: "Message" }),
    ).toBeVisible();
    await expect(mainBody).toHaveStyle("overflow: hidden");
    await expect(mainBody).toHaveAttribute("data-layout", "regions");
    await expect(mainBody.scrollHeight).toBe(mainBody.clientHeight);

    await userEvent.click(canvas.getByRole("button", { name: "All" }));
    const overlay = within(document.body);
    const inboxOptions = canvas.getByRole("button", {
      name: "Inbox options",
    });
    await expect(
      overlay.getByRole("menuitemradio", { name: "All" }),
    ).toHaveAttribute("data-state", "checked");
    await expect(
      overlay.getByRole("menuitemradio", { name: "Mentions" }),
    ).toHaveAttribute("data-state", "unchecked");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(getComputedStyle(inboxOptions).pointerEvents).not.toBe("none");
    });

    await userEvent.click(inboxOptions);
    await expect(
      overlay.getByRole("menuitemcheckbox", { name: "Show unread only" }),
    ).toBeVisible();
    await expect(
      overlay.getByRole("menuitem", { name: "Mark all as read" }),
    ).toBeVisible();
    await userEvent.keyboard("{Escape}");
    const manageChannel = canvas.getByRole("button", {
      name: "Manage channel",
    });
    await waitFor(() => {
      expect(getComputedStyle(manageChannel).pointerEvents).not.toBe("none");
    });

    await userEvent.click(manageChannel);
    await expect(canvas.getByLabelText("Channel settings")).toBeVisible();
    await expect(canvas.getByText("Channel settings")).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Close channel settings" }),
    );
    await expect(canvas.queryByLabelText("Channel settings")).toBeNull();
    await expect(shellRoot).toBeInTheDocument();
    if (storybookRoot) {
      await expect(getComputedStyle(storybookRoot).padding).toBe("0px");
    }
    await expect(document.body.scrollHeight).toBe(document.body.clientHeight);
  }}
>
  {#snippet template()}
    <CommunityNavigationShellFixture />
  {/snippet}
</Story>

<Story name="Settings">
  {#snippet template()}
    <CommunityNavigationShellFixture initialActiveItemId="settings" />
  {/snippet}
</Story>

<Story
  name="Desktop channel"
  play={async ({ canvas }) => {
    const frame = canvas.getByTestId("community-workspace-frame");

    await waitFor(() => {
      expect(frame).toHaveAttribute("data-community-status", "connected");
    });
    if (frame.dataset.communityBackend === "live") return;

    await expect(
      canvas.getByRole("heading", { name: "#general" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Browse channels" }),
    ).toBeVisible();

    const composer = canvas.getByRole("combobox", { name: "Message" });
    await userEvent.type(composer, "A channel interaction fixture");
    await userEvent.keyboard("{Enter}");
    await expect(
      await canvas.findByText("A channel interaction fixture"),
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
>
  {#snippet template()}
    <CommunityWorkspaceStoryHarness initialModel={createChannelStoryModel()} />
  {/snippet}
</Story>

<Story
  name="Channel thread open"
  play={async ({ canvas }) => {
    const frame = canvas.getByTestId("community-workspace-frame");
    await waitFor(() => {
      expect(frame).toHaveAttribute("data-community-status", "connected");
    });
    if (frame.dataset.communityBackend === "live") return;
    await userEvent.click(
      canvas.getAllByRole("button", { name: "0 replies" })[0]!,
    );
    const threadSidebar = await canvas.findByLabelText("Thread sidebar");
    const thread = within(threadSidebar);

    await expect(threadSidebar).toBeVisible();
    await expect(thread.getByText("Thread")).toBeVisible();
    const composer = thread.getByRole("combobox", { name: "Message" });
    await userEvent.type(composer, "A thread interaction fixture");
    await userEvent.keyboard("{Enter}");
    await expect(
      await thread.findByText("A thread interaction fixture"),
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
>
  {#snippet template()}
    <CommunityWorkspaceStoryHarness
      initialModel={createChannelStoryModel("thread")}
    />
  {/snippet}
</Story>
