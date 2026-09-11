<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import CommunitySkeleton from "./CommunitySkeleton.svelte";
  const { Story } = defineMeta({
    title: "Community/Primitives/Skeleton",
    component: CommunitySkeleton,
    tags: ["visual-pending"],
  });
</script>

<Story name="Gallery" args={{ layout: "gallery", label: "Loading agents" }} />
<Story
  name="Timeline"
  args={{ layout: "timeline", label: "Loading activity" }}
/>
<Story
  name="Messages"
  args={{ layout: "messages", label: "Loading messages" }}
/>
<Story name="Details" args={{ layout: "details", label: "Loading details" }} />
<Story
  name="Repository"
  args={{ layout: "repository", label: "Loading repository" }}
/>
