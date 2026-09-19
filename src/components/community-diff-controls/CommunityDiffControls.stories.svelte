<script module lang="ts">
  import consumerSource from "../community-patterns/examples/AgentDiscussionExample.svelte?raw";
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import CommunityDiffControls from "./CommunityDiffControls.svelte";
  const { Story } = defineMeta({
    title: "Community/Projects/Diff controls",
    component: CommunityDiffControls,
    tags: ["visual-pending"],
    parameters: {
      docs: { source: { code: consumerSource, language: "svelte" } },
    },
  });
</script>

<Story
  name="Switch view and wrap"
  play={async ({ canvas }) => {
    const split = canvas.getByRole("radio", { name: "Show split diff" });
    await userEvent.click(split);
    await expect(split).toHaveAttribute("data-state", "on");
    const wrap = canvas.getByRole("button", { name: "Wrap text" });
    await userEvent.click(wrap);
    await expect(wrap).toHaveAttribute("aria-pressed", "true");
  }}
/>
