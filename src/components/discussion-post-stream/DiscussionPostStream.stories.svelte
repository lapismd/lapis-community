<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import {
    noMorePosts,
    noop,
    storyPosts,
    storyProfiles,
    storyReactions,
  } from "../story-fixtures.js";
  import DiscussionPostStream from "./DiscussionPostStream.svelte";

  const { Story } = defineMeta({
    title: "Community/Discussion/Post stream",
    component: DiscussionPostStream,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Flat chronological replies"
  args={{
    posts: storyPosts,
    contextPosts: storyPosts,
    reactions: storyReactions,
    profiles: storyProfiles,
    startIndex: 0,
    total: storyPosts.length,
    activePostId: storyPosts[0].event.id,
    hasPrevious: false,
    hasNext: false,
    loadingPrevious: false,
    loadingNext: false,
    onCurrentPost: noop,
    onPrepend: noMorePosts,
    onAppend: noMorePosts,
    onNavigate: noop,
    onReply: noop,
    onReact: noop,
  }}
/>
