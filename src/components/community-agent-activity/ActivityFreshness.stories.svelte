<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within, waitFor } from "storybook/test";
  import CommunityAgentActivity from "./CommunityAgentActivity.svelte";
  import Harness from "./ActivityFreshnessHarness.svelte";
  const { Story } = defineMeta({
    title: "Community/Agents/Activity freshness",
    component: CommunityAgentActivity,
    tags: ["visual-pending"],
    parameters: {
      docs: {
        source: {
          code: 'import { CommunityAgentActivity } from "@lapismd/lapis-community/components";\n<CommunityAgentActivity {model} {onLatest} {onLoadOlder} {onClearHistory} />',
          language: "svelte",
        },
      },
    },
  });
</script>

<Story
  name="Unavailable catch-up stops every animation and current snapshots recover"
  play={async ({ canvas }) => {
    const log = canvas.getByRole("log", {
      name: "Agent conversation activity",
    });
    await expect(
      within(log).getByRole("button", { name: /Thinking/ }),
    ).toHaveAttribute("aria-expanded", "false");
    await expect(
      within(log).getAllByText("Status unavailable", { exact: true })[0],
    ).toBeVisible();
    expect(log.querySelector('[data-streaming="true"]')).toBeNull();
    expect(log.querySelector('[data-status="running"]')).toBeNull();
    await userEvent.click(
      canvas.getByRole("button", { name: "Receive current snapshot" }),
    );
    await waitFor(() =>
      expect(log.querySelector('[data-status="running"]')).not.toBeNull(),
    );
    await expect(
      within(log).getByRole("button", { name: /Thinking/ }),
    ).toHaveAttribute("aria-expanded", "true");
  }}>{#snippet template()}<Harness />{/snippet}</Story
>
