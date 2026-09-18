<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn } from "storybook/test";

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
        protected_patterns: ["refs/heads/release/*"],
        document_patterns: ["refs/heads/release/*"],
        required_approvals: 2,
        admin_bypass: false,
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
    await expect(canvas.getByText("refs/heads/release/*")).toBeVisible();
    await expect(canvas.getByText("2")).toBeVisible();
    await expect(canvas.getByText("Disabled")).toBeVisible();
    await expect(canvas.getByText(/cannot disable the default/u)).toBeVisible();
    await expect(canvas.getByText(/docs\//u)).toBeVisible();
    await expect(
      canvas.getByText(/lives at the repository root/u),
    ).toBeVisible();
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

<Story
  name="Saves hosted branch protection"
  args={{
    canMaintain: true,
    capabilities: {
      merge: true,
      protection: {
        default_branch: "main",
        protected_ref: "refs/heads/main",
        protected_patterns: ["refs/heads/release/*"],
        document_patterns: ["refs/heads/release/*"],
        required_approvals: 1,
        admin_bypass: false,
        pull_requests_required: true,
        merge_actors: "channel_maintainers",
      },
    },
    onSaveProtection: fn(),
  }}
  play={async ({ args, canvas, userEvent }) => {
    await userEvent.type(
      canvas.getByLabelText("Extra protected refs"),
      "hotfix/*",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Add pattern" }));
    await userEvent.click(canvas.getByLabelText("Allow admin bypass"));
    await userEvent.click(
      canvas.getByRole("button", { name: "Save branch protection" }),
    );
    await expect(args.onSaveProtection).toHaveBeenCalledWith({
      protected_patterns: ["refs/heads/release/*", "refs/heads/hotfix/*"],
      required_approvals: 1,
      admin_bypass: true,
    });
  }}
>
  {#snippet template(args)}
    <CommunityProjectsRepositorySettings {...args} />
  {/snippet}
</Story>

<Story
  name="Opens channel People"
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
    peopleChannelName: "dev",
    onOpenPeople: fn(),
  }}
  play={async ({ args, canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Open #dev to manage People" }),
    );
    await expect(args.onOpenPeople).toHaveBeenCalledOnce();
  }}
>
  {#snippet template(args)}
    <CommunityProjectsRepositorySettings {...args} />
  {/snippet}
</Story>
