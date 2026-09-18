<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect } from "storybook/test";

  import CommunityProjectsRepositorySettings from "./CommunityProjectsRepositorySettings.svelte";

  const { Story } = defineMeta({
    title: "Community/Projects/Repository settings",
    component: CommunityProjectsRepositorySettings,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Hosted branch protection"
  args={{
    capabilities: {
      merge: true,
      protection: {
        default_branch: "main",
        protected_ref: "refs/heads/main",
        pull_requests_required: true,
        merge_actors: "channel_maintainers",
      },
    },
    owners: {
      rules: [{ path: "docs/", pubkeys: ["a".repeat(64)] }],
    },
  }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText("refs/heads/main")).toBeVisible();
    await expect(canvas.getByText(/docs\//u)).toBeVisible();
  }}
>
  {#snippet template(args)}
    <CommunityProjectsRepositorySettings {...args} />
  {/snippet}
</Story>

<Story
  name="GitHub authoritative protection"
  args={{
    capabilities: {
      merge: true,
      protection: { github_authoritative: true, merge_actors: "github" },
    },
  }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText(/stay on GitHub/u)).toBeVisible();
  }}
>
  {#snippet template(args)}
    <CommunityProjectsRepositorySettings {...args} />
  {/snippet}
</Story>
