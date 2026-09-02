<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import CommunitySummary from "./CommunitySummary.svelte";

  const { Story } = defineMeta({
    title: "Community/Registry/Summary",
    component: CommunitySummary,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Active discussion"
  args={{ posts: 248, reactions: 37, participants: 64, pluginReactions: 91 }}
/>
