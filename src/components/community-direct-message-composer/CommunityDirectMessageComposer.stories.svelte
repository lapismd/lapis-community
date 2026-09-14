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
      canvas.getByRole("textbox", { name: "Markdown editor" }),
      "Hello Member",
    );
    await userEvent.keyboard("{Enter}");
    await expect(args.onSend).toHaveBeenCalledWith("Hello Member", "nip17");
  }}
>
  {#snippet template(args)}<CommunityDirectMessageComposer
      {...args}
    />{/snippet}</Story
>

<Story
  name="Explicit Buzz transport"
  args={{
    recipients: [
      { id: "member", name: "Member", handle: "member", initials: "ME" },
    ],
    buzzSupported: true,
    onSend: fn(),
  }}
  play={async ({ canvas, args }) => {
    await userEvent.click(
      canvas.getByRole("switch", { name: "Relay-readable Buzz messaging" }),
    );
    await expect(
      canvas.getByText(
        "Send a relay-readable Buzz message to up to eight people.",
      ),
    ).toBeVisible();
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Markdown editor" }),
      "Buzz message",
    );
    await userEvent.keyboard("{Enter}");
    await expect(args.onSend).toHaveBeenCalledWith("Buzz message", "buzz-dm");
  }}
  >{#snippet template(args)}<CommunityDirectMessageComposer
      {...args}
    />{/snippet}</Story
>
