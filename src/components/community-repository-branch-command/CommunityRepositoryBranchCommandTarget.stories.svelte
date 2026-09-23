<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";

  import CommunityRepositoryBranchCommand from "./CommunityRepositoryBranchCommand.svelte";

  const branches = [
    { name: "main", sha: "a".repeat(40) },
    { name: "feature/files", sha: "b".repeat(40) },
    { name: "jj-sync/scope/replica", sha: "c".repeat(40) },
  ];

  const { Story } = defineMeta({
    title: "Community/Projects/Branch command",
    component: CommunityRepositoryBranchCommand,
    tags: ["visual-pending"],
    args: {
      branch: "main",
      branches,
      includeSync: false,
      label: "Base branch",
      heading: "Select base branch",
      onSelectBranch: fn(),
    },
    parameters: {
      docs: {
        source: {
          language: "svelte",
          code: `<CommunityRepositoryBranchCommand
  branch="main"
  {branches}
  includeSync={false}
  label="Base branch"
  heading="Select base branch"
  onSelectBranch={selectRepositoryBranch}
/>`,
        },
        description: {
          component: "Merge-target branch command without the Files Sync tab.",
        },
      },
    },
  });
</script>

<Story
  name="Merge target without Sync"
  play={async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      canvas.getByRole("combobox", { name: "Base branch" }),
    );
    await expect(
      page.getByRole("heading", { name: "Select base branch" }),
    ).toBeVisible();
    await expect(page.queryByRole("tab", { name: "Sync" })).toBeNull();
    await expect(page.queryByRole("tab", { name: "Branches" })).toBeNull();
    await expect(page.getByRole("option", { name: "main" })).toBeVisible();
    await expect(
      page.queryByRole("option", { name: "jj-sync/scope/replica" }),
    ).toBeNull();
    await userEvent.click(page.getByRole("option", { name: "feature/files" }));
  }}
/>
