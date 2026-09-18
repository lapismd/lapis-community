<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn } from "storybook/test";

  import CommunityProjectsRepositoryOverview from "./CommunityProjectsRepositoryOverview.svelte";

  const hostedProtection = {
    merge: true,
    protection: {
      default_branch: "main",
      protected_ref: "refs/heads/main",
      pull_requests_required: true,
      merge_actors: "channel_maintainers",
    },
  };

  const { Story } = defineMeta({
    title: "Community/Projects/Repository overview",
    component: CommunityProjectsRepositoryOverview,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Overview hides repository settings"
  args={{
    capabilities: hostedProtection,
    tree: {
      ref: "main",
      sha: "d".repeat(40),
      path: "",
      entries: [],
      readme: "# Community Client\n\nRelay-hosted overview.",
    },
  }}
  play={async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Community Client" }),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("heading", { name: "Permissions" }),
    ).not.toBeInTheDocument();
  }}
>
  {#snippet template(args)}
    <CommunityProjectsRepositoryOverview {...args} />
  {/snippet}
</Story>

<Story
  name="Options surface shows repository settings"
  args={{
    surface: "options",
    capabilities: hostedProtection,
    tree: {
      ref: "main",
      sha: "d".repeat(40),
      path: "",
      entries: [],
      readme: "# Community Client\n\nRelay-hosted overview.",
    },
  }}
  play={async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Permissions" }),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("heading", { name: "Community Client" }),
    ).not.toBeInTheDocument();
  }}
>
  {#snippet template(args)}
    <CommunityProjectsRepositoryOverview {...args} />
  {/snippet}
</Story>

<Story
  name="Options people opens member command"
  args={{
    surface: "options",
    capabilities: hostedProtection,
    homeChannelId: "dev",
    rooms: [{ id: "dev-room", name: "dev", kind: "channel", groupId: "dev" }],
    onOpenPeople: fn(),
  }}
  play={async ({ args, canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Add people to #dev" }),
    );
    await expect(args.onOpenPeople).toHaveBeenCalledWith("dev-room");
  }}
>
  {#snippet template(args)}
    <CommunityProjectsRepositoryOverview {...args} />
  {/snippet}
</Story>
