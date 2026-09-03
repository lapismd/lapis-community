<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";
  import CommunitySearchCommand from "./CommunitySearchCommand.svelte";
  const { Story } = defineMeta({
    title: "Community/Search/Search command",
    component: CommunitySearchCommand,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Results"
  args={{
    open: true,
    query: "lapis",
    rooms: [{ id: "general", name: "lapis-general", kind: "channel" }],
    messages: [
      {
        id: "message",
        authorId: "steve",
        content: "Welcome to Lapis Community",
        timestamp: "now",
      },
    ],
    members: [
      {
        id: "steve",
        name: "Lapis member",
        handle: "steve",
        initials: "LM",
      },
    ],
    onSelectRoom: fn(),
  }}
  play={async ({ canvasElement, args }) => {
    const overlay = within(canvasElement.ownerDocument.body);
    await expect(
      overlay.getByRole("option", { name: /Welcome to Lapis Community/u }),
    ).toBeVisible();
    await expect(
      overlay.getByRole("option", { name: /Lapis member/u }),
    ).toBeVisible();
    await expect(
      overlay.queryByRole("option", { name: /^\{/u }),
    ).not.toBeInTheDocument();
    await userEvent.click(overlay.getByRole("option", { name: /general/ }));
    await expect(args.onSelectRoom).toHaveBeenCalledWith(
      expect.objectContaining({ id: "general" }),
    );
    const closeButton = overlay.getByRole("button", { name: "Close" });
    await expect(closeButton).toHaveAttribute("data-variant", "ghost");
    await userEvent.hover(closeButton);
    await expect(closeButton).toBeVisible();
  }}
>
  {#snippet template(args)}<CommunitySearchCommand {...args} />{/snippet}</Story
>
