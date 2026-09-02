<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

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
    signedInPubkey: "f".repeat(64),
    comment: "A progress affordance would help here.",
    onCancel: noop,
    onConnect: noop,
    onSubmit: noop,
  }}
/>
