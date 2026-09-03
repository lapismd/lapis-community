<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "storybook/test";

  import { noop, storyPosts, storyProfiles } from "../story-fixtures.js";
  import DiscussionComposer from "./DiscussionComposer.svelte";

  const { Story } = defineMeta({
    title: "Community/Discussion/Composer",
    component: DiscussionComposer,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="New comment"
  args={{
    name: "AI",
    profiles: storyProfiles,
    postNumber: () => 1,
    signedInPubkey: "",
    comment: "",
    onCancel: noop,
    onConnect: noop,
    onSubmit: noop,
  }}
/>

<Story
  name="Replying"
  args={{
    name: "AI",
    replyingTo: storyPosts[1],
    profiles: storyProfiles,
    postNumber: () => 2,
    signedInPubkey: storyPosts[0].event.pubkey,
    comment: "A progress affordance would help here.",
    onCancel: noop,
    onConnect: noop,
    onSubmit: noop,
  }}
  play={async ({ canvas }) => {
    const textarea = canvas.getByRole("textbox", { name: "Reply to a post" });
    await expect(getComputedStyle(textarea).backgroundColor).not.toBe(
      "rgba(0, 0, 0, 0)",
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Open profile for Ada Lovelace" }),
    );
    await expect(
      within(document.body).getByRole("heading", { name: "Ada Lovelace" }),
    ).toBeVisible();
  }}
/>
