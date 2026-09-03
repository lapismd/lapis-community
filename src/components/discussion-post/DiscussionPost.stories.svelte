<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";

  import { noop, storyPosts, storyProfiles } from "../story-fixtures.js";
  import DiscussionPost from "./DiscussionPost.svelte";

  const { Story } = defineMeta({
    title: "Community/Discussion/Post",
    component: DiscussionPost,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Reply with reactions"
  args={{
    post: storyPosts[1],
    parent: storyPosts[0],
    profiles: storyProfiles,
    number: 2,
    parentReference: "#1",
    active: true,
    groups: [{ content: "👍", symbol: "👍", count: 4 }],
    onNavigate: noop,
    onReply: noop,
    onReact: fn(),
  }}
  play={async ({ args, canvas }) => {
    await expect(
      canvas.getByText(/The local inference path is working well/u),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "React to post 2" }),
    );
    await userEvent.click(
      within(document.body).getByRole("button", { name: "React ❤️" }),
    );
    await expect(args.onReact).toHaveBeenCalledWith(storyPosts[1], "❤️");
  }}
/>
