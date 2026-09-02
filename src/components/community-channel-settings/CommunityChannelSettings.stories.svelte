<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { AppShell, AppShellController } from "@lapismd/design-core/shell";
  import { expect, fn, userEvent, waitFor } from "storybook/test";
  import CommunityAppShell from "../community-app-shell/CommunityAppShell.svelte";
  import { communityInboxFixture } from "../community-inbox/story-fixtures.js";
  import CommunityChannelSettings from "./CommunityChannelSettings.svelte";

  const controller = new AppShellController({ rightWidth: 320 });

  const { Story } = defineMeta({
    title: "Community/Channels/Channel Settings",
    component: CommunityChannelSettings,
    tags: ["visual-pending"],
    parameters: { layout: "fullscreen", communityAppShell: true },
  });
</script>

<Story
  name="Welcome channel"
  args={{
    room: {
      ...communityInboxFixture.room,
      private: true,
      memberCount: communityInboxFixture.participantCount,
    },
    members: communityInboxFixture.members,
    description:
      "This private channel is your home base for getting oriented and working with your community.",
    onAction: fn(),
  }}
  play={async ({ canvas, canvasElement, args }) => {
    await expect(canvas.getByText("Channel settings")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: /Channel type/ }),
    ).toBeVisible();

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
      canvas.getByRole("button", { name: "Delete channel" }),
    );
    await expect(args.onAction).toHaveBeenCalledWith("delete-channel");
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
