<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "storybook/test";
  import CommunityAgentActivity from "./CommunityAgentActivity.svelte";
  import Harness from "./ActivityLifecycleHarness.svelte";
  const { Story } = defineMeta({
    title: "Community/Agents/Activity lifecycle",
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
  name="Live progress and completion"
  play={async ({ canvas }) => {
    const log = canvas.getByRole("log", {
      name: "Agent conversation activity",
    });
    const working = within(log).getByRole("status");
    await expect(working).toHaveTextContent("Working");
    await expect(
      within(log).getByRole("button", { name: /Thinking/ }),
    ).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(canvas.getByRole("button", { name: "Next update" }));
    await expect(
      within(log).getByRole("button", { name: /Thinking/ }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(log.querySelector('[data-status="running"]')).not.toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Next update" }));
    expect(log.querySelector('[data-status="running"]')).toBeNull();
    await expect(working).toBeVisible();
    const tool = log.querySelector('[data-ui-component="ai-chat-tool-calls"]')!;
    expect(
      tool.compareDocumentPosition(working) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await userEvent.click(canvas.getByRole("button", { name: "Next update" }));
    expect(within(log).queryByRole("status")).not.toBeInTheDocument();
    expect(log.querySelector('[data-streaming="true"]')).toBeNull();
    expect(log.scrollWidth).toBeLessThanOrEqual(log.clientWidth);
  }}
>
  {#snippet template()}<Harness />{/snippet}
</Story>

<Story name="Live working">{#snippet template()}<Harness />{/snippet}</Story>
