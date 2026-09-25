<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fireEvent, fn, waitFor } from "storybook/test";

  import type {
    ProjectForgeCommit,
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
  const virtualCommits = Array.from({ length: 160 }, (_, index) => ({
    sha: (index + 1).toString(16).padStart(40, "0"),
    subject: `Virtualized commit ${index + 1}`,
    body:
      index % 7 === 0
        ? "A longer commit body exercises the measured row-height handoff."
        : undefined,
    author: index % 2 === 0 ? "Noor Patel" : "Maya Chen",
    author_email: index % 2 === 0 ? "noor@example.test" : "maya@example.test",
    commit_date: new Date(Date.UTC(2026, 8, 18, 9, index)).toISOString(),
  })) satisfies ProjectForgeCommit[];

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

<Story
  name="Repository commits virtualized window"
  args={{
    commits: virtualCommits,
    selectedRepository: notes,
    repositories: [notes],
    hasMore: true,
    onLoadMore: fn(),
  }}
  play={async ({ args, canvas, canvasElement }) => {
    await expect(
      canvas.getByRole("button", { name: "Virtualized commit 1" }),
    ).toBeVisible();
    const viewport = canvasElement.querySelector<HTMLElement>(
      '[data-story-part="bounded-scroll"]',
    );
    if (!viewport) throw new Error("Missing bounded scroll story host");
    await waitFor(() => {
      const rows = viewport.querySelectorAll('[data-ui-part="virtual-row"]');
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.length).toBeLessThan(48);
    });
    viewport.scrollTop = viewport.scrollHeight;
    await fireEvent.scroll(viewport);
    await waitFor(() => expect(args.onLoadMore).toHaveBeenCalled());
  }}
>
  {#snippet template(args)}
    <div
      data-story-part="bounded-scroll"
      style="height: 320px; overflow: auto; border: 1px solid var(--border); border-radius: 0.75rem;"
    >
      <CommunityProjectsCommitList {...args} />
    </div>
  {/snippet}
</Story>
