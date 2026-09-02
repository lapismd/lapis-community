<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";

  import CommunityProfileMenu from "./CommunityProfileMenu.svelte";

  const member = {
    id: "steve",
    name: "steve",
    handle: "steve",
    initials: "SJ",
    presence: "online" as const,
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
    canManageCommunity: true,
    onAction: fn(),
  }}
  play={async ({ args, canvas, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Open profile menu for steve" }),
    );
    const overlay = within(canvasElement.ownerDocument.body);
    await expect(
      overlay.getByRole("menuitem", { name: "Update your status" }),
    ).toBeVisible();
    await expect(overlay.getByRole("menuitem", { name: "buzz" })).toBeVisible();
    await expect(
      overlay.getByRole("menuitem", { name: "Send feedback" }),
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
