<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { fn } from "storybook/test";

  import {
    communityStoryMembers,
    communityStoryTopics,
  } from "../community-workspace/story-fixtures.js";
  import ForumTopicList from "./ForumTopicList.svelte";

  const { Story } = defineMeta({
    title: "Community/Forums/Topic List",
    component: ForumTopicList,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Active support topics"
  args={{
    title: "support-ai",
    description: "Questions, guides, and support for the AI plugin",
    topics: communityStoryTopics,
    members: communityStoryMembers,
    onOpenTopic: fn(),
  }}
/>
