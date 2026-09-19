<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect } from "storybook/test";

  import type {
    ProjectForgeCommitActivity,
    ProjectForgeProject,
    ProjectForgeRepository,
  } from "../../projects/index.js";
  import CommunityProjectsCommitList from "./CommunityProjectsCommitList.svelte";

  const notes = {
    address: {
      kind: 30_617,
      owner: "1".repeat(64),
      identifier: "notes",
      coordinate: "30617:owner:notes",
    },
    name: "notes-desktop",
    repositoryClass: "hosted",
  } as ProjectForgeRepository;
  const project = {
    address: { coordinate: "30621:owner:notes" },
    repositories: [{ coordinate: notes.address.coordinate }],
  } as ProjectForgeProject;
  const commitActivity = [
    {
      projectCoordinate: project.address.coordinate,
      repositoryCoordinate: notes.address.coordinate,
      commit: {
        sha: "a".repeat(40),
        subject: "Group project commits by repository",
        author: "Noor Patel",
        author_email: "noor@example.test",
        commit_date: "2026-09-18T09:30:00Z",
      },
    },
  ] as ProjectForgeCommitActivity[];

  const { Story } = defineMeta({
    title: "Community/Projects/Commit list",
    component: CommunityProjectsCommitList,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Project workspace commits"
  args={{
    commitActivity,
    selectedProject: project,
    repositories: [notes],
  }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText("notes-desktop")).toBeVisible();
    await expect(
      canvas.getByRole("button", {
        name: "Group project commits by repository",
      }),
    ).toBeVisible();
  }}
>
  {#snippet template(args)}
    <CommunityProjectsCommitList {...args} />
  {/snippet}
</Story>
