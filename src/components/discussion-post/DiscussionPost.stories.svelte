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

  const recentPost = {
    ...storyPosts[1],
    event: {
      ...storyPosts[1]!.event,
      created_at: Math.floor(Date.now() / 1_000) - 120,
    },
  };
</script>

<Story
  name="Reply with reactions"
  args={{
    post: recentPost,
    parent: storyPosts[0],
    profiles: storyProfiles,
    number: 2,
    parentReference: "#1",
    active: true,
    groups: [{ content: "👍", symbol: "👍", count: 4, selected: true }],
    onNavigate: noop,
    onReply: noop,
    onReact: fn(),
    onOpenProfile: fn(),
    onMessageMember: fn(),
    onWaveMember: fn(),
  }}
  play={async ({ args, canvas }) => {
    const post = canvas.getByRole("article");
    const page = within(post.ownerDocument.body);
    await expect(getComputedStyle(post).borderRadius).not.toBe("0px");
    await expect(
      canvas.getByText(/The local inference path is working well/u),
    ).toBeVisible();
    const existingReaction = canvas.getByRole("button", {
      name: "4 reactions with 👍",
    });
    await expect(existingReaction).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(existingReaction);
    await expect(args.onReact).toHaveBeenCalledWith(recentPost, "👍");

    const timestamp = canvas.getByRole("link", { name: "Link to post 2" });
    await expect(timestamp).toHaveTextContent(/minutes? ago/u);
    await expect(timestamp).toHaveAttribute(
      "title",
      new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(recentPost.event.created_at * 1_000),
    );

    const avatar = canvas.getByRole("button", {
      name: "View Ben Stone's profile",
    });
    await expect(avatar).toBeVisible();

    await userEvent.click(
      canvas.getByRole("button", { name: "React to post 2" }),
    );
    await userEvent.click(page.getByRole("button", { name: "React ❤️" }));
    await expect(args.onReact).toHaveBeenCalledWith(recentPost, "❤️");
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
