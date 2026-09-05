<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor } from "storybook/test";

  import { noop } from "../story-fixtures.js";
  import DiscussionTimeline from "./DiscussionTimeline.svelte";
  import DiscussionTimelineInteractionHarness from "./DiscussionTimelineInteractionHarness.svelte";

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

<Story
  name="Stable delayed scrubber"
  play={async ({ canvas }) => {
    const harness = canvas.getByTestId("timeline-interaction-harness");
    const slider = canvas.getByRole("slider", {
      name: "Discussion position",
    });
    const bounds = slider.getBoundingClientRect();
    let seeksDuringMove = "";
    slider.addEventListener(
      "pointermove",
      () => (seeksDuringMove = harness.dataset.seeks ?? ""),
      { once: true },
    );
    await userEvent.pointer([
      {
        keys: "[MouseLeft>]",
        target: slider,
        coords: { x: bounds.left + 8, y: bounds.top + bounds.height / 2 },
      },
      {
        target: slider,
        coords: { x: bounds.left + 8, y: bounds.bottom + 120 },
      },
      {
        keys: "[/MouseLeft]",
        target: slider,
        coords: { x: bounds.left + 8, y: bounds.bottom + 120 },
      },
    ]);
    expect(seeksDuringMove).toBe("0");
    await expect(harness).toHaveAttribute("data-seeks", "1");
    await expect(harness).toHaveAttribute("data-pending", "true");
    expect(Number(slider.getAttribute("aria-valuenow"))).toBeGreaterThan(19);
    await waitFor(
      () => expect(harness).toHaveAttribute("data-pending", "false"),
      { timeout: 2_000 },
    );
  }}
>
  {#snippet template()}
    <DiscussionTimelineInteractionHarness />
  {/snippet}
</Story>
