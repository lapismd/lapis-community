<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import { noop } from "../story-fixtures.js";
  import DiscussionHeading from "./DiscussionHeading.svelte";

  const { Story } = defineMeta({
    title: "Community/Discussion/Heading",
    component: DiscussionHeading,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Paginated discussion"
  args={{
    total: 184,
    displayedStart: 41,
    displayedEnd: 60,
    onRefresh: noop,
  }}
/>
