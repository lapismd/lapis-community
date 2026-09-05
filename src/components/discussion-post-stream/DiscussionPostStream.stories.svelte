<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect } from "storybook/test";

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
  play={async ({ canvas }) => {
    const activePost = canvas.getAllByRole("article")[0]!;
    const activeStyle = getComputedStyle(activePost);
    await expect(Number.parseFloat(activeStyle.marginTop)).toBeGreaterThan(0);
    await expect(Number.parseFloat(activeStyle.marginRight)).toBeGreaterThan(0);
    await expect(Number.parseFloat(activeStyle.marginBottom)).toBeGreaterThan(
      0,
    );
    await expect(Number.parseFloat(activeStyle.marginLeft)).toBeGreaterThan(0);
  }}
/>
