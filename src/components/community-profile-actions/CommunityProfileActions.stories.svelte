<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import CommunityProfileActions from "./CommunityProfileActions.svelte";
  import Example from "../community-patterns/examples/ProfileActionsExample.svelte";
  import source from "../community-patterns/examples/ProfileActionsExample.svelte?raw";
  const { Story } = defineMeta({
    title: "Community/Patterns/Profile actions",
    component: CommunityProfileActions,
    tags: ["visual-pending"],
    parameters: { docs: { source: { code: source, language: "svelte" } } },
  });
</script>

<Story
  name="Contract"
  play={async ({ canvas }) => {
    const group = canvas.getByRole("group", { name: "Agent actions" });
    const stop = canvas.getByRole("button", { name: "Cancel turn" });
    const reset = canvas.getByRole("button", { name: "Reset conversation" });
    expect(
      Math.abs(
        stop.getBoundingClientRect().top - reset.getBoundingClientRect().top,
      ),
    ).toBeLessThan(1);
    expect(group.scrollWidth).toBeLessThanOrEqual(group.clientWidth);
    await userEvent.click(stop);
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Cancellation requested",
    );
  }}
>
  {#snippet template()}<Example />{/snippet}
</Story>
