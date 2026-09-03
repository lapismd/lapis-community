<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";

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
    onSubmit: fn(async () => true),
  }}
  play={async ({ canvas, args }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Start a discussion about AI" }),
    );
    const composer = canvas.getByRole("combobox", { name: "Message" });
    await expect(composer).toHaveFocus();
    await userEvent.type(composer, "A portable registry is useful.");
    await userEvent.keyboard("{Enter}");
    await expect(args.onSubmit).toHaveBeenCalledWith(
      "A portable registry is useful.",
    );
    await expect(
      canvas.getByRole("button", { name: "Start a discussion about AI" }),
    ).toBeVisible();
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
    onSubmit: noop,
  }}
  play={async ({ canvas }) => {
    const composer = canvas.getByRole("combobox", { name: "Message" });
    await expect(composer).toHaveTextContent(
      "A progress affordance would help here.",
    );
    await expect(
      canvas.getByRole("group", { name: "Replying to Ben Stone" }),
    ).toHaveTextContent(
      "I tested with roughly 8,000 notes. Index warm-up dominates, then responses stay comfortably interactive.",
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Open profile for Ada Lovelace" }),
    );
    await expect(
      within(document.body).getByRole("heading", { name: "Ada Lovelace" }),
    ).toBeVisible();
  }}
/>
