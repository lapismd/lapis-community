<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";
  import CommunityTopicComposer from "./CommunityTopicComposer.svelte";
  const { Story } = defineMeta({
    title: "Community/Forums/Topic composer",
    component: CommunityTopicComposer,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="New topic"
  args={{ open: true, forumName: "support", onPublish: fn() }}
  play={async ({ canvasElement, args }) => {
    const overlay = within(canvasElement.ownerDocument.body);
    await userEvent.type(overlay.getByLabelText("Title"), "Portable forums");
    await userEvent.type(
      overlay.getByLabelText("Message"),
      "How should portable forums work?",
    );
    await userEvent.click(
      overlay.getByRole("button", { name: "Publish topic" }),
    );
    await expect(args.onPublish).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Portable forums" }),
    );
  }}
>
  {#snippet template(args)}<CommunityTopicComposer {...args} />{/snippet}</Story
>
