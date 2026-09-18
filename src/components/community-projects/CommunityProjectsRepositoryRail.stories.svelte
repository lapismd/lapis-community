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
  name="Repository options rail"
  args={{
    surface: "overview",
    name: "community-client",
    sourceLabel: "Relay hosted",
    files: 3,
    commits: [{ sha: "d".repeat(40) }],
    tasks: [{ lifecycle: "open" }],
    reviews: [{ lifecycle: "open" }],
    onSelect: fn(),
  }}
  play={async ({ args, canvas, userEvent }) => {
    const options = canvas.getByRole("button", { name: "Options" });
    await expect(options).toBeVisible();
    await expect(options.querySelector(".lucide-settings")).not.toBeNull();
    await expect(
      canvas.queryByRole("heading", { name: "Permissions" }),
    ).not.toBeInTheDocument();
    await userEvent.click(options);
    await expect(args.onSelect).toHaveBeenCalledWith("Options");
  }}
>
  {#snippet template(args)}
    <CommunityProjectsRepositoryRail {...args} />
  {/snippet}
</Story>

<Story
  name="Options item is current"
  args={{
    surface: "options",
    name: "community-client",
    sourceLabel: "Relay hosted",
    onSelect: fn(),
  }}
  play={async ({ canvas }) => {
    const options = canvas.getByRole("button", { name: "Options" });
    await expect(options).toHaveAttribute("aria-current", "page");
    await expect(options).toBeVisible();
  }}
>
  {#snippet template(args)}
    <CommunityProjectsRepositoryRail {...args} />
  {/snippet}
</Story>
