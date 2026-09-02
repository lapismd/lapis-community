<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

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
    onReact: noop,
  }}
/>
