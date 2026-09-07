<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, waitFor, within } from "storybook/test";

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
    const post = canvas.getByRole("article");
    await expect(getComputedStyle(post).borderRadius).not.toBe("0px");
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

<Story
  name="Author edit delete and report actions"
  args={{
    post: { ...storyPosts[1], edited: true },
    parent: storyPosts[0],
    profiles: storyProfiles,
    number: 2,
    parentReference: "#1",
    currentMemberId: storyPosts[1].event.pubkey,
    onNavigate: noop,
    onReply: noop,
    onReact: noop,
    onEdit: fn(),
    onDelete: fn(),
    onReport: fn(),
  }}
  play={async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const post = canvas.getByRole("article");
    const view = within(post);
    await expect(view.getByText("(edited)")).toBeVisible();
    const moreActions = view.getByRole("button", {
      name: "More actions for post 2",
    });
    moreActions.focus();
    await waitFor(() => expect(moreActions).toBeVisible());

    await userEvent.click(moreActions);
    await expect(
      await page.findByRole("menuitem", { name: "Edit message" }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "Report message" }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "Delete message" }),
    ).toBeVisible();
  }}
/>
