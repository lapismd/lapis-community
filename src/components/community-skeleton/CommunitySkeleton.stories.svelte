<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect } from "storybook/test";

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
<Story
  name="Padded thread"
  args={{ layout: "messages", label: "Loading thread", padded: true }}
  play={async ({ canvas }) => {
    const skeleton = canvas.getByRole("status", { name: "Loading thread" });
    const items = skeleton.querySelector(".community-skeleton__items");
    await expect(items).not.toBeNull();
    const pane = skeleton.getBoundingClientRect();
    const rows = items!.getBoundingClientRect();
    await expect(rows.left).toBeGreaterThan(pane.left);
    await expect(rows.top).toBeGreaterThan(pane.top);
    await expect(rows.right).toBeLessThan(pane.right);
  }}
/>
