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
    await expect(canvas.queryByRole("heading", { name: "Permissions" })).not.toBeInTheDocument();
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
    const latest = canvas.getByRole("button", { name: /Latest/u });
    await expect(options).toHaveAttribute("aria-current", "page");
    await expect(options).toHaveAttribute("data-active", "");
    await expect(getComputedStyle(options).fontSize).toBe(getComputedStyle(latest).fontSize);
    await expect(getComputedStyle(options).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    await expect(canvas.queryByText("Relay hosted")).not.toBeInTheDocument();
  }}
>
  {#snippet template(args)}
    <CommunityProjectsRepositoryRail {...args} />
  {/snippet}
</Story>

<Story
  name="Overview shows relay hosted chrome"
  args={{
    surface: "overview",
    name: "community-client",
    sourceLabel: "Relay hosted",
    channel: "plugin-development",
    files: 3,
    onSelect: fn(),
  }}
  play={async ({ canvas }) => {
    const hosted = canvas.getByText("Relay hosted");
    await expect(hosted).toBeVisible();
    await expect(hosted.closest("div")).toHaveClass(
      "community-application__project-overview-repository",
    );
    await expect(canvas.getByText("Channel")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "plugin-development" }).querySelector(".lucide-hash")).not.toBeNull();
    await expect(canvas.getByText("Details")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Options" })).toBeVisible();
  }}
>
  {#snippet template(args)}
    <CommunityProjectsRepositoryRail {...args} />
  {/snippet}
</Story>

<Story
  name="Files hides options"
  args={{
    surface: "files",
    name: "community-client",
    sourceLabel: "Relay hosted",
    files: 3,
    onSelect: fn(),
  }}
  play={async ({ canvas }) => {
    await expect(canvas.queryByRole("button", { name: "Options" })).not.toBeInTheDocument();
    await expect(canvas.queryByText("Relay hosted")).not.toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: /Files/u })).toBeVisible();
  }}
>
  {#snippet template(args)}
    <CommunityProjectsRepositoryRail {...args} />
  {/snippet}
</Story>
