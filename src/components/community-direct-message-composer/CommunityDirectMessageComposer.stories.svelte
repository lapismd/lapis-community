<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent } from "storybook/test";
  import CommunityDirectMessageComposer from "./CommunityDirectMessageComposer.svelte";
  const { Story } = defineMeta({
    title: "Community/Direct messages/New message",
    component: CommunityDirectMessageComposer,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Compose"
  args={{
    recipients: [
      { id: "member", name: "Member", handle: "member", initials: "ME" },
    ],
    onSend: fn(),
  }}
  play={async ({ canvas, args }) => {
    await userEvent.type(
      canvas.getByRole("combobox", { name: "Message" }),
      "Hello Member",
    );
    await userEvent.keyboard("{Enter}");
    await expect(args.onSend).toHaveBeenCalledWith("Hello Member");
  }}
>
  {#snippet template(args)}<CommunityDirectMessageComposer
      {...args}
    />{/snippet}</Story
>
