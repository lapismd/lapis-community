<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";

  import {
    PROJECT_ACTIVITY_FILTER_DEFAULT,
    type ProjectActivityFilterId,
  } from "../../projects/activity-filters.js";
  import CommunityProjectsActivityFilter from "./CommunityProjectsActivityFilter.svelte";

  const { Story } = defineMeta({
    title: "Community/Projects/Activity Feed",
    component: CommunityProjectsActivityFilter,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Activity event-type filter"
  args={{
    value: PROJECT_ACTIVITY_FILTER_DEFAULT,
    onSelect: fn<(value: ProjectActivityFilterId) => void>(),
  }}
  play={async ({ canvas, canvasElement, args }) => {
    const page = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("button", { name: "Filter activity" });
    await expect(trigger).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(trigger);
    await expect(
      page.getByRole("heading", { name: "Filter activity" }),
    ).toBeVisible();
    await expect(page.getByText("Kind 1621 work items")).toBeVisible();
    const tasks = page.getByRole("option", { name: /Tasks Kind 1621/u });
    const reviews = page.getByRole("option", { name: /Reviews Kind 1618/u });
    await expect(tasks.querySelector(".lucide-circle-dot")).not.toBeNull();
    await expect(reviews.querySelector(".lucide-git-pull-request")).not.toBeNull();
    await userEvent.click(tasks);
    await expect(args.onSelect).toHaveBeenCalledWith("task");
  }}
>
  {#snippet template(args)}
    <CommunityProjectsActivityFilter {...args} />
  {/snippet}
</Story>
