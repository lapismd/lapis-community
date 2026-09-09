<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, waitFor, within } from "storybook/test";

  import CommunityProfileMenu from "./CommunityProfileMenu.svelte";

  const member = {
    id: "steve",
    name: "steve",
    handle: "steve",
    initials: "SJ",
    presence: "online" as const,
    status: "🏠 Working remotely",
  };

  const { Story } = defineMeta({
    title: "Community/Navigation/Profile Menu",
    component: CommunityProfileMenu,
    tags: ["visual-pending"],
    parameters: {
      docs: {
        source: {
          language: "svelte",
          code: `<CommunityProfileMenu
  {member}
  communityName="buzz"
  communityUrl="wss://relay.example.com"
  onAction={(action) => handleProfileAction(action)}
/>`,
        },
      },
    },
  });
</script>

<Story
  name="Signed-in member"
  args={{
    member,
    communityName: "buzz",
    communityUrl: "wss://relay.example.com",
    canManageCommunity: true,
    canSendFeedback: true,
    onAction: fn(),
    onPresenceChange: fn(),
  }}
  play={async ({ args, canvas, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Open profile menu for steve" }),
    );
    const overlay = within(canvasElement.ownerDocument.body);
    await expect(
      overlay.getByRole("menuitem", { name: "🏠 Working remotely" }),
    ).toBeVisible();
    const profileMenu = overlay.getByRole("menu", { name: "Profile menu" });
    const communityTrigger = overlay.getByRole("menuitem", {
      name: "buzz community actions",
    });
    await expect(communityTrigger).toBeVisible();
    await userEvent.click(communityTrigger);
    const communityMenu = await overlay.findByRole("menu", {
      name: "Community actions",
    });
    const copyCommunityUrl = within(communityMenu).getByRole("menuitem", {
      name: "Copy community URL",
    });
    await expect(copyCommunityUrl).toBeVisible();
    await waitFor(() =>
      expect(getComputedStyle(copyCommunityUrl).pointerEvents).not.toBe("none"),
    );
    await expect(copyCommunityUrl.querySelector("svg")).not.toBeNull();
    await expect(
      within(communityMenu)
        .getByRole("menuitem", { name: "Community settings" })
        .querySelector("svg"),
    ).not.toBeNull();
    await expect(
      within(communityMenu)
        .getByRole("menuitem", { name: "Manage members" })
        .querySelector("svg"),
    ).not.toBeNull();
    await userEvent.click(copyCommunityUrl);
    await waitFor(() =>
      expect(args.onAction).toHaveBeenCalledWith("copy-community-url"),
    );
    await waitFor(() =>
      expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
        "none",
      ),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Open profile menu for steve" }),
    );
    await userEvent.click(
      overlay.getByRole("menuitem", { name: "Presence: Online" }),
    );
    const presenceMenu = await overlay.findByRole("menu", {
      name: "Presence status",
    });
    await expect(
      within(presenceMenu).queryByText("Presence status"),
    ).toBeNull();
    await expect(Number(getComputedStyle(presenceMenu).zIndex)).toBeGreaterThan(
      Number(getComputedStyle(profileMenu).zIndex),
    );
    await userEvent.click(
      within(presenceMenu).getByRole("menuitemradio", { name: "Away" }),
    );
    await waitFor(() => expect(args.onPresenceChange).toHaveBeenCalledTimes(1));
    await expect(args.onPresenceChange).toHaveBeenCalledWith("away");
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
        "none",
      ),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Open profile menu for steve" }),
    );
    await expect(
      overlay.getByRole("menuitem", { name: "Send feedback" }),
    ).toBeVisible();
    await expect(
      overlay.getByRole("menuitem", { name: "Sign out" }),
    ).toBeVisible();
    await userEvent.click(overlay.getByRole("menuitem", { name: /Settings/ }));
    await expect(args.onAction).toHaveBeenCalledWith("settings");
  }}
/>

<Story
  name="Compact rail"
  args={{
    member,
    communityName: "buzz",
    compact: true,
    canManageCommunity: true,
    onAction: fn(),
  }}
/>

<Story
  name="Logged-out reader"
  args={{
    member: { ...member, name: "Guest", handle: "not-signed-in" },
    communityName: "buzz",
    authenticated: false,
    canManageCommunity: false,
    canSendFeedback: false,
    onAction: fn(),
  }}
  play={async ({ args, canvas, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Open profile menu for Guest" }),
    );
    const overlay = within(canvasElement.ownerDocument.body);
    const menu = overlay.getByRole("menu", { name: "Profile menu" });
    await expect(
      menu.querySelector('[data-ui-part$="-separator"]:last-child'),
    ).toBeNull();
    await expect(
      overlay.queryByRole("menuitem", { name: "Update your status" }),
    ).not.toBeInTheDocument();
    await expect(
      overlay.queryByRole("menuitem", { name: "Manage members" }),
    ).not.toBeInTheDocument();
    await expect(
      overlay.queryByRole("menuitem", { name: /^Settings$/u }),
    ).not.toBeInTheDocument();
    await userEvent.click(overlay.getByRole("menuitem", { name: "Sign in" }));
    await expect(args.onAction).toHaveBeenCalledWith("sign-in");
  }}
/>
