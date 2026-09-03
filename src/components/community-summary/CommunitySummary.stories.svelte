<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect } from "storybook/test";

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
  play={async ({ canvasElement }) => {
    const metrics = canvasElement.querySelectorAll<HTMLElement>(
      ".topic-summary > div",
    );
    const first = getComputedStyle(metrics[0]!);
    const last = getComputedStyle(metrics[metrics.length - 1]!);
    await expect(first.borderLeftWidth).toBe("1px");
    await expect(first.borderTopLeftRadius).not.toBe("0px");
    await expect(first.borderBottomLeftRadius).not.toBe("0px");
    await expect(last.borderRightWidth).toBe("1px");
    await expect(last.borderTopRightRadius).not.toBe("0px");
    await expect(last.borderBottomRightRadius).not.toBe("0px");
  }}
/>
