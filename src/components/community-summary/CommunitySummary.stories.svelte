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
    const icons = canvasElement.querySelectorAll<HTMLElement>(
      '[data-ui-part="summary-icon"]',
    );
    const first = getComputedStyle(metrics[0]!);
    const last = getComputedStyle(metrics[metrics.length - 1]!);
    await expect(Number.parseFloat(first.borderLeftWidth)).toBeGreaterThan(0);
    await expect(first.borderTopLeftRadius).not.toBe("0px");
    await expect(first.borderBottomLeftRadius).not.toBe("0px");
    await expect(Number.parseFloat(last.borderRightWidth)).toBeGreaterThan(0);
    await expect(last.borderTopRightRadius).not.toBe("0px");
    await expect(last.borderBottomRightRadius).not.toBe("0px");
    await expect(icons).toHaveLength(4);
    for (const icon of icons) {
      await expect(getComputedStyle(icon).backgroundColor).not.toBe(
        "rgba(0, 0, 0, 0)",
      );
    }
  }}
/>

<Story
  name="Constrained responsive grid"
  args={{ posts: 260, reactions: 13, participants: 4, pluginReactions: 2 }}
  play={async ({ canvasElement }) => {
    const metrics = canvasElement.querySelectorAll<HTMLElement>(
      ".topic-summary > div",
    );
    const first = metrics[0]!.getBoundingClientRect();
    const third = metrics[2]!.getBoundingClientRect();
    await expect(third.top).toBeGreaterThan(first.top);
    const icons = canvasElement.querySelectorAll<HTMLElement>(
      '[data-ui-part="summary-icon"]',
    );
    await expect(
      Math.abs(
        icons[0]!.getBoundingClientRect().left -
          icons[2]!.getBoundingClientRect().left,
      ),
    ).toBeLessThan(1);
  }}
>
  {#snippet template(args)}
    <div style="width: min(100%, 38rem);">
      <CommunitySummary {...args} />
    </div>
  {/snippet}
</Story>
