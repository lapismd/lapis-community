<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent } from "storybook/test";
  import CommunityReplyPreview from "./CommunityReplyPreview.svelte";
  const { Story } = defineMeta({
    title: "Community/Messages/Reply preview",
    component: CommunityReplyPreview,
    tags: ["visual-pending"],
    args: {
      target: {
        authorName: "Nyra",
        content: "Read LICENSE and check the patent clause",
      },
    },
    parameters: {
      docs: {
        source: {
          code: '<CommunityReplyPreview target={{ authorName: "Nyra", content: "Read LICENSE" }} {onOpen} />',
          language: "svelte",
        },
      },
    },
  });
</script>

<Story
  name="Target navigation is keyboard accessible"
  args={{ onOpen: fn() }}
  play={async ({ canvas, args }) => {
    const target = canvas.getByRole("button", { name: /Replying to Nyra/ });
    target.focus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onOpen).toHaveBeenCalledOnce();
    await expect(target).toHaveTextContent("Read LICENSE");
  }}
/>
<Story name="Narrow preview retains the full excerpt">
  {#snippet template(args)}<div style="width: 240px">
      <CommunityReplyPreview {...args} />
    </div>{/snippet}
</Story>
