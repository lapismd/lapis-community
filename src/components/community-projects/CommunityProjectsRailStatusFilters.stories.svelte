<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn } from "storybook/test";

  import CommunityProjectsRepositoryRail from "./CommunityProjectsRepositoryRail.svelte";

  const { Story } = defineMeta({
    title: "Community/Projects/Repository rail",
    component: CommunityProjectsRepositoryRail,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Tasks status filters"
  args={{
    surface: "tasks",
    tasks: [{ lifecycle: "open" }, { lifecycle: "closed" }],
    onSelect: fn(),
  }}
  play={async ({ canvas, args, userEvent }) => {
    const tasks = canvas.getByRole("button", { name: /^Tasks/u });
    const active = canvas.getByRole("button", { name: /^Active/u });
    const completed = canvas.getByRole("button", { name: /^Completed/u });
    await expect(tasks).toHaveAttribute("aria-current", "page");
    await expect(active).toHaveAttribute("aria-pressed", "true");
    await expect(active).toHaveAttribute("data-active", "");
    await expect(completed).toHaveAttribute("aria-pressed", "false");
    await expect(completed).not.toHaveAttribute("data-active");
    await expect(completed).not.toHaveAttribute("aria-current");
    await expect(Number.parseFloat(getComputedStyle(active).fontSize)).toBeLessThan(
      Number.parseFloat(getComputedStyle(tasks).fontSize),
    );
    await expect(active.getBoundingClientRect().left).toBeGreaterThan(
      tasks.getBoundingClientRect().left + 12,
    );
    await userEvent.click(completed);
    await expect(args.onSelect).toHaveBeenCalledWith("Completed");
  }}
>
  {#snippet template(args)}
    <CommunityProjectsRepositoryRail {...args} />
  {/snippet}
</Story>

<Story
  name="Reviews status filters"
  args={{
    surface: "reviews",
    reviews: [{ lifecycle: "open" }, { lifecycle: "merged" }],
    onSelect: fn(),
  }}
  play={async ({ canvas, args, userEvent }) => {
    const reviews = canvas.getByRole("button", { name: /^Reviews/u });
    const open = canvas.getByRole("button", { name: /^Open/u });
    const merged = canvas.getByRole("button", { name: /^Merged/u });
    await expect(reviews).toHaveAttribute("aria-current", "page");
    await expect(open).toHaveAttribute("aria-pressed", "true");
    await expect(open).toHaveAttribute("data-active", "");
    await expect(merged).toHaveAttribute("aria-pressed", "false");
    await expect(merged).not.toHaveAttribute("data-active");
    await expect(merged).not.toHaveAttribute("aria-current");
    await expect(Number.parseFloat(getComputedStyle(open).fontSize)).toBeLessThan(
      Number.parseFloat(getComputedStyle(reviews).fontSize),
    );
    await expect(open.getBoundingClientRect().left).toBeGreaterThan(
      reviews.getBoundingClientRect().left + 12,
    );
    await userEvent.click(merged);
    await expect(args.onSelect).toHaveBeenCalledWith("Merged");
  }}
>
  {#snippet template(args)}
    <CommunityProjectsRepositoryRail {...args} />
  {/snippet}
</Story>

<Story
  name="Commits latest is a label"
  args={{
    surface: "commits",
    commits: [{ sha: "2c87cf6".padEnd(40, "0") }],
    onSelect: fn(),
  }}
  play={async ({ canvas }) => {
    const latest = canvas.getByText("Latest");
    await expect(latest.closest("button")).toBeNull();
    await expect(
      canvas.queryByRole("button", { name: /^Latest$/u }),
    ).not.toBeInTheDocument();
    await expect(getComputedStyle(latest.closest("div")!).backgroundColor).toBe(
      "rgba(0, 0, 0, 0)",
    );
    await expect(
      canvas.getByRole("button", { name: /^Commits/u }),
    ).toHaveAttribute("aria-current", "page");
  }}
>
  {#snippet template(args)}
    <CommunityProjectsRepositoryRail {...args} />
  {/snippet}
</Story>
