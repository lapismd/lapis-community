<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, waitFor, within } from "storybook/test";

  import CommunityRepositoryBranchCommand from "./CommunityRepositoryBranchCommand.svelte";

  const branches = [
    { name: "main", sha: "a".repeat(40) },
    { name: "feature/files", sha: "b".repeat(40) },
    {
      name: "jj-sync/scope/replica",
      sha: "c".repeat(40),
    },
  ];

  const { Story } = defineMeta({
    title: "Community/Projects/Branch command",
    component: CommunityRepositoryBranchCommand,
    tags: ["visual-pending"],
    args: {
      branch: "main",
      branches,
      onSelectBranch: fn(),
    },
    parameters: {
      docs: {
        source: {
          language: "svelte",
          code: `<CommunityRepositoryBranchCommand
  branch="main"
  {branches}
  onSelectBranch={selectRepositoryBranch}
/>`,
        },
        description: {
          component:
            "Repository branch switcher using Design Core Command View in a Popover, with workspace branches and jj-sync carriers on separate tabs.",
        },
      },
    },
  });
</script>

<Story
  name="Command view switcher"
  play={async ({ canvas, canvasElement, args }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      canvas.getByRole("combobox", { name: "Repository branch" }),
    );
    const title = page.getByRole("heading", { name: "Switch branches" });
    await expect(title).toBeVisible();
    await expect(
      Number.parseFloat(getComputedStyle(title).fontWeight),
    ).toBeGreaterThanOrEqual(700);
    const search = page.getByPlaceholderText("Find a branch...");
    const searchGroup = search.closest('[data-ui-part="input-group"]');
    if (!searchGroup) throw new Error("Expected the command input group");
    await userEvent.click(search);
    await expect(search).toHaveFocus();
    const searchStyle = getComputedStyle(searchGroup);
    await expect(
      Number.parseFloat(searchStyle.borderTopLeftRadius),
    ).toBeGreaterThan(16);
    await expect(searchStyle.borderTopColor).toMatch(
      /transparent|rgba\(0,\s*0,\s*0,\s*0\)|oklab\(0 0 0 \/ 0\)/u,
    );
    await expect(searchStyle.outlineStyle).toBe("solid");
    await expect(searchStyle.outlineWidth).toBe("3px");
    await expect(page.getByRole("tab", { name: "Branches" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("option", { name: "main" })).toBeVisible();
    await expect(
      page.getByRole("option", { name: "feature/files" }),
    ).toBeVisible();
    await expect(page.getByText("default")).toBeVisible();
    await expect(
      page.queryByRole("option", { name: "jj-sync/scope/replica" }),
    ).toBeNull();
    await userEvent.click(page.getByRole("tab", { name: "Sync" }));
    await expect(page.getByRole("tab", { name: "Sync" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      page.getByRole("option", { name: "jj-sync/scope/replica" }),
    ).toBeVisible();
    await userEvent.click(page.getByRole("tab", { name: "Branches" }));
    await userEvent.type(search, "feature");
    await expect(
      page.getByRole("option", { name: "feature/files" }),
    ).toBeVisible();
    await expect(page.queryByRole("option", { name: "main" })).toBeNull();
    await userEvent.click(page.getByRole("option", { name: "feature/files" }));
    await expect(args.onSelectBranch).toHaveBeenCalledWith("feature/files");
    await waitFor(() =>
      expect(
        page.queryByRole("heading", { name: "Switch branches" }),
      ).toBeNull(),
    );
  }}
/>

<Story
  name="Sync tab selected"
  args={{
    branch: "jj-sync/scope/replica",
    branches,
    onSelectBranch: fn(),
  }}
  play={async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      canvas.getByRole("combobox", { name: "Repository branch" }),
    );
    await expect(page.getByRole("tab", { name: "Sync" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      page.getByRole("option", { name: "jj-sync/scope/replica" }),
    ).toBeVisible();
    await expect(page.queryByRole("option", { name: "main" })).toBeNull();
  }}
/>
