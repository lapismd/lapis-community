<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";

  import {
    PROJECT_ACTIVITY_FILTER_SELECTION_DEFAULT,
    type ProjectActivityFilterId,
  } from "../../projects/activity-filters.js";
  import CommunityProjectsActivityFilter from "./CommunityProjectsActivityFilter.svelte";

  const { Story } = defineMeta({
    title: "Community/Projects/Activity Feed",
    component: CommunityProjectsActivityFilter,
    tags: ["visual-pending"],
  });
</script>

<script lang="ts">
  let selection = $state<ProjectActivityFilterId[]>([
    ...PROJECT_ACTIVITY_FILTER_SELECTION_DEFAULT,
  ]);
</script>

<Story
  name="Activity event-type filter"
  args={{
    value: PROJECT_ACTIVITY_FILTER_SELECTION_DEFAULT,
    onChange: fn<(value: ProjectActivityFilterId[]) => void>(),
  }}
  play={async ({ canvas, canvasElement, args }) => {
    const page = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("button", { name: "Filter activity" });
    await expect(trigger).toHaveAttribute("aria-pressed", "false");
    await expect(trigger).toHaveAttribute("data-variant", "ghost");
    await userEvent.click(trigger);
    await expect(
      page.getByRole("heading", { name: "Filter activity" }),
    ).toBeVisible();
    await expect(page.getByText("Kind 1621 work items")).toBeVisible();
    const tasks = page.getByRole("option", { name: /Tasks Kind 1621/u });
    const reviews = page.getByRole("option", { name: /Reviews Kind 1618/u });
    await expect(tasks.querySelector(".lucide-circle-dot")).not.toBeNull();
    await expect(
      reviews.querySelector(".lucide-git-pull-request"),
    ).not.toBeNull();
    await userEvent.click(tasks);
    await expect(args.onChange).toHaveBeenCalledWith(["task"]);
    await expect(
      page.getByRole("heading", { name: "Filter activity" }),
    ).toBeVisible();
    await expect(tasks).toHaveAttribute("data-checked", "");
    await userEvent.click(reviews);
    await expect(args.onChange).toHaveBeenCalledWith(["task", "review"]);
    await expect(reviews).toHaveAttribute("data-checked", "");
    const ordered = page.getAllByRole("option");
    await expect(ordered[0]).toHaveAccessibleName(/Tasks Kind 1621/u);
    await expect(ordered[1]).toHaveAccessibleName(/Reviews Kind 1618/u);
    const check = tasks.querySelector(
      '[data-ui-part="trailing"] svg',
    ) as SVGElement;
    await expect(check).toHaveAttribute("width", "12");
    await expect(trigger).toHaveAttribute("aria-pressed", "true");
    await expect(trigger).toHaveAttribute("data-variant", "default");
  }}
>
  {#snippet template(args)}
    <CommunityProjectsActivityFilter
      value={selection}
      onChange={(next) => {
        selection = next;
        args.onChange(next);
      }}
    />
  {/snippet}
</Story>
