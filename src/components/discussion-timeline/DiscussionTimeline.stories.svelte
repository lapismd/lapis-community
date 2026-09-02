<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import { noop } from "../story-fixtures.js";
  import DiscussionTimeline from "./DiscussionTimeline.svelte";

  const { Story } = defineMeta({
    title: "Community/Discussion/Timeline",
    component: DiscussionTimeline,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Long discussion position"
  args={{
    total: 2_000,
    currentIndex: 873,
    currentTimestamp: 1_788_203_600,
    firstTimestamp: 1_787_000_000,
    lastTimestamp: 1_789_000_000,
    returnIndex: 32,
    onJump: noop,
    onReturn: noop,
  }}
/>
