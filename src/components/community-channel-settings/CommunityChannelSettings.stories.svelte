<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { AppShell, AppShellController } from "@lapismd/design-core/shell";
  import { expect, fn, userEvent, waitFor } from "storybook/test";
  import CommunityAppShell from "../community-app-shell/CommunityAppShell.svelte";
  import { communityInboxFixture } from "../community-inbox/story-fixtures.js";
  import CommunityChannelSettings from "./CommunityChannelSettings.svelte";

  const controller = new AppShellController({ rightWidth: 320 });
  const enabled = { state: "enabled" as const };
  const requiresAuthentication = {
    state: "requires-authentication" as const,
    reason: "Sign in to manage this channel",
    requirement: "authentication" as const,
  };

  const { Story } = defineMeta({
    title: "Community/Channels/Channel Settings",
    component: CommunityChannelSettings,
    tags: ["visual-pending"],
    parameters: {
      layout: "fullscreen",
      communityAppShell: true,
    },
  });
</script>

<Story
  name="Welcome channel"
  args={{
    room: {
      ...communityInboxFixture.room,
      private: true,
      memberCount: communityInboxFixture.participantCount,
      membership: "joined" as const,
      permissions: {
        publish: enabled,
        join: enabled,
        leave: enabled,
        update: enabled,
        delete: enabled,
        manageMembers: enabled,
      },
    },
    members: communityInboxFixture.members,
    description:
      "This private channel is your home base for getting oriented and working with your community.",
    writerPolicySupported: true,
    groupInvitesSupported: true,
    onClose: fn(),
    onAction: fn(),
    canvas: {
      roomId: "general",
      groupId: "general",
      content: "# Shared project notes",
      eventId: "head",
      author: "author",
      updatedAt: 100,
      loading: false,
      canEdit: true,
    },
    onLoadCanvas: fn(),
    onSaveCanvas: fn(),
  }}
  play={async ({ canvas, canvasElement, args }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: /Canvas Shared project notes/ }),
    );
    await expect(
      canvas.getByRole("heading", { name: "Shared project notes" }),
    ).toBeVisible();
    await expect(args.onLoadCanvas).toHaveBeenCalled();
    await userEvent.click(
      canvas.getByRole("button", { name: "Back to channel" }),
    );
    await expect(canvas.getByText("Channel settings")).toBeVisible();
    const channelType = canvas.getByRole("button", { name: /Channel type/ });
    await expect(channelType).toBeVisible();
    await expect(
      getComputedStyle(channelType.querySelector("strong")!).fontWeight,
    ).toBe("400");

    const channelId = canvas.getByRole("button", { name: /Channel ID/ });
    const copyIcon = canvasElement.querySelector<SVGElement>(
      ".lc-channel-settings__copy-icon",
    );
    if (!copyIcon) throw new Error("Expected the channel ID copy icon");
    await expect(copyIcon).not.toBeVisible();
    channelId.focus();
    await waitFor(() => expect(copyIcon).toBeVisible());
    await userEvent.keyboard("{Enter}");
    await expect(args.onAction).toHaveBeenCalledWith("copy-channel-id");

    await userEvent.click(
      canvas.getByRole("button", { name: /Posting permissions/ }),
    );
    await expect(args.onAction).toHaveBeenCalledWith("edit-posting");
    await userEvent.click(
      canvas.getByRole("button", { name: /Create invite link/ }),
    );
    await expect(args.onAction).toHaveBeenCalledWith("create-invite");

    const leave = canvas.getByRole("button", { name: "Leave channel" });
    const deleteChannel = canvas.getByRole("button", {
      name: "Delete channel",
    });
    await expect(getComputedStyle(leave).color).toBe(
      getComputedStyle(deleteChannel).color,
    );
    await expect(getComputedStyle(leave).color).not.toBe(
      getComputedStyle(channelType).color,
    );
    await expect(leave.querySelector("svg")).not.toBeNull();
    await userEvent.click(leave);
    await expect(args.onAction).toHaveBeenCalledWith("leave-channel");

    await userEvent.click(deleteChannel);
    await expect(args.onAction).toHaveBeenCalledWith("delete-channel");

    await expect(
      canvas.getByRole("button", { name: "Close channel settings" }),
    ).toBeVisible();
  }}
>
  {#snippet template(args)}
    <CommunityAppShell
      {controller}
      displayMode="desktop"
      desktopMinMainWidth={0}
    >
      <AppShell.Main>
        <AppShell.Body label="Settings preview">Channel</AppShell.Body>
      </AppShell.Main>
      <AppShell.Sidebar side="right" label="Channel settings" closeable>
        <CommunityChannelSettings {...args} />
      </AppShell.Sidebar>
    </CommunityAppShell>
  {/snippet}
</Story>

<Story
  name="Management capabilities unavailable"
  args={{
    room: {
      ...communityInboxFixture.room,
      private: true,
      permissions: {
        publish: enabled,
        join: enabled,
        leave: enabled,
        update: enabled,
        delete: enabled,
        manageMembers: enabled,
      },
    },
    members: communityInboxFixture.members,
    description: "A relay without role, writer-policy, or invite support.",
    writerPolicySupported: false,
    groupInvitesSupported: false,
    onClose: fn(),
    onAction: fn(),
  }}
  play={async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", { name: /Visibility/ }),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: /Posting permissions/ }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole("button", { name: /Create invite link/ }),
    ).not.toBeInTheDocument();
  }}
>
  {#snippet template(args)}
    <CommunityAppShell
      {controller}
      displayMode="desktop"
      desktopMinMainWidth={0}
    >
      <AppShell.Main>
        <AppShell.Body label="Settings preview">Channel</AppShell.Body>
      </AppShell.Main>
      <AppShell.Sidebar side="right" label="Channel settings" closeable>
        <CommunityChannelSettings {...args} />
      </AppShell.Sidebar>
    </CommunityAppShell>
  {/snippet}
</Story>

<Story
  name="Signed-out actions omitted"
  args={{
    room: {
      ...communityInboxFixture.room,
      permissions: {
        publish: requiresAuthentication,
        join: requiresAuthentication,
        leave: requiresAuthentication,
        update: requiresAuthentication,
        delete: requiresAuthentication,
        manageMembers: requiresAuthentication,
      },
    },
    members: communityInboxFixture.members,
    description: "Introductions and community onboarding",
    writerPolicySupported: true,
    groupInvitesSupported: true,
    onClose: fn(),
    onAction: fn(),
  }}
  play={async ({ canvas, canvasElement }) => {
    await expect(
      canvas.queryByRole("button", { name: "Leave channel" }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole("button", { name: "Delete channel" }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole("button", { name: /Posting permissions/ }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole("button", { name: /Create invite link/ }),
    ).not.toBeInTheDocument();
    await expect(
      canvasElement.querySelector(".lc-channel-settings__danger-zone"),
    ).toBeNull();
  }}
>
  {#snippet template(args)}
    <CommunityAppShell
      {controller}
      displayMode="desktop"
      desktopMinMainWidth={0}
    >
      <AppShell.Main>
        <AppShell.Body label="Settings preview">Channel</AppShell.Body>
      </AppShell.Main>
      <AppShell.Sidebar side="right" label="Channel settings" closeable>
        <CommunityChannelSettings {...args} />
      </AppShell.Sidebar>
    </CommunityAppShell>
  {/snippet}
</Story>

<Story
  name="Forum"
  args={{
    room: {
      ...communityInboxFixture.room,
      id: "support-ai",
      name: "support-ai",
      kind: "forum" as const,
      memberCount: communityInboxFixture.participantCount,
      postingPolicy: "writers" as const,
      private: true,
    },
    members: communityInboxFixture.members,
    description: "Questions, guides, and support for the AI plugin.",
    writerPolicySupported: true,
    groupInvitesSupported: true,
    onClose: fn(),
    onAction: fn(),
  }}
  play={async ({ canvas, args }) => {
    await expect(canvas.getByText("Forum settings")).toBeVisible();
    await expect(canvas.getByText("Writers and administrators")).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: /Create invite link/ }),
    );
    await expect(args.onAction).toHaveBeenCalledWith("create-invite");
    const leave = canvas.getByRole("button", { name: "Leave forum" });
    const deleteForum = canvas.getByRole("button", { name: "Delete forum" });
    await expect(getComputedStyle(leave).color).toBe(
      getComputedStyle(deleteForum).color,
    );
    await expect(leave.querySelector("svg")).not.toBeNull();
    await userEvent.click(leave);
    await expect(args.onAction).toHaveBeenCalledWith("leave-channel");
  }}
>
  {#snippet template(args)}
    <CommunityAppShell
      {controller}
      displayMode="desktop"
      desktopMinMainWidth={0}
    >
      <AppShell.Main>
        <AppShell.Body label="Settings preview">Forum</AppShell.Body>
      </AppShell.Main>
      <AppShell.Sidebar side="right" label="Forum settings" closeable>
        <CommunityChannelSettings {...args} />
      </AppShell.Sidebar>
    </CommunityAppShell>
  {/snippet}
</Story>
