<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import CommunityProjectsStoryHarness from "./CommunityProjectsStoryHarness.svelte";
  import CommunityProjects from "./CommunityProjects.svelte";
  import {
    contextFixture as f,
    repositoryContextEvents,
  } from "../../testing/repository-context-fixture.js";
  const commit = {
    sha: f.commit,
    subject: "Document agent checkpoints",
    author: "Nyra",
    author_email: "nyra@nostr.invalid",
    commit_date: "2026-09-19T12:00:00Z",
  };
  const { Story } = defineMeta({
    title: "Community/Projects/Agent Commit Detail",
    component: CommunityProjects,
    tags: ["visual-pending"],
    args: {
      view: "commits",
      projects: [],
      repositories: [],
      members: [],
      rooms: [],
      tasks: [],
      pullRequests: [],
      showNavigation: false,
      selectedCommit: commit,
      workItemEvents: repositoryContextEvents(),
      selectedCommitDetail: {
        commit,
        stats: [{ path: "README.md", additions: 1, deletions: 0 }],
        patch:
          "diff --git a/README.md b/README.md\n--- a/README.md\n+++ b/README.md\n@@ -1 +1,2 @@\n # Demo\n+Agent checkpoints retain context.\n",
      },
    },
    parameters: {
      layout: "fullscreen",
      communityAppShell: true,
      docs: {
        source: {
          code: '<CommunityProjects view="commits" selectedCommit={commit} {selectedCommitDetail} {workItemEvents} />',
        },
      },
    },
  });
</script>

<Story
  name="Context before changed files"
  play={async ({ canvas }) => {
    const context = canvas.getByRole("button", { name: /Agent context/ });
    const files = canvas.getByRole("button", { name: "Files changed 1" });
    await expect(context).toHaveAttribute("aria-expanded", "false");
    await expect(
      context.compareDocumentPosition(files) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await userEvent.click(context);
    await expect(
      canvas.getByText("Updated the README and verified the diff."),
    ).toBeVisible();
    await expect(
      canvas.getByText("apply_patch", { exact: true }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Show details for apply_patch" }),
    );
    await expect(
      canvas.getByText("README.md: add checkpoint example", { exact: true }),
    ).toBeVisible();
    await expect(
      canvas.getByText("Success. Updated README.md", { exact: true }),
    ).toBeVisible();
    await expect(files).toBeVisible();
  }}
>
  {#snippet template(args)}<CommunityProjectsStoryHarness {...args} />{/snippet}
</Story>
