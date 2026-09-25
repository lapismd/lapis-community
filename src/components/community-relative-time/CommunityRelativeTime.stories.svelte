<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";

  import CommunityRelativeTime from "./CommunityRelativeTime.svelte";

  const now = Date.UTC(2026, 8, 8, 12, 0, 0) / 1_000;
  const { Story } = defineMeta({
    title: "Community/Shared/Relative Time",
    component: CommunityRelativeTime,
    tags: ["visual-pending"],
    args: {
      timestamp: now - 60 * 60,
      now,
    },
    parameters: {
      layout: "centered",
      docs: {
        source: {
          language: "svelte",
          code: `<CommunityRelativeTime timestamp={message.createdAt} />`,
        },
      },
    },
  });
</script>

<Story
  name="Recent timestamp"
  play={async ({ canvas }) => {
    const time = canvas.getByText("1 hour ago");
    await expect(time).toBeVisible();
    await expect(getComputedStyle(time).display).toBe("inline-flex");
    await expect(time.getBoundingClientRect().width).toBeLessThan(100);
    await userEvent.hover(time);
    await expect(time).toHaveAttribute("data-state", "instant-open");
    await expect(time).toHaveAttribute("aria-describedby");
    await expect(time).toHaveAttribute("title", expect.stringContaining("2026"));
  }}
/>

<Story
  name="Older timestamp"
  args={{ timestamp: now - 60 * 60 * 24 * 8 }}
  play={async ({ canvas }) => {
    const time = canvas.getByText(/2026/u);
    await expect(time.textContent ?? "").not.toMatch(/\d:\d{2}/u);
    await expect(time).toHaveAttribute("title", expect.stringMatching(/\d:\d{2}/u));
  }}
/>
