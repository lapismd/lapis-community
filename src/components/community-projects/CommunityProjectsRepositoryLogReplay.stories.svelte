<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor } from "storybook/test";
  import CommunityProjectsRepositoryLog from "./CommunityProjectsRepositoryLog.svelte";
  import Harness from "./CommunityProjectsRepositoryLogNavigationHarness.svelte";
  import {
    replayCommit,
    rewrittenMergeEvents,
    emptyMergeEvents,
  } from "../../testing/repository-log-replay-fixtures.js";

  const { Story } = defineMeta({
    title: "Community/Projects/Repository Log Replay",
    component: CommunityProjectsRepositoryLog,
    tags: ["visual-pending"],
    parameters: {
      docs: {
        source: {
          code: '<CommunityProjectsRepositoryLog {events} repositoryAddress="30617:owner:probe" />',
          language: "svelte",
        },
      },
    },
  });
</script>

<Story
  name="Rewritten merge parents after loading"
  play={async ({ canvas }) => {
    await expect(canvas.getByText("Loading repository log")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Load history" }));
    const graph = await canvas.findByRole("list", { name: "Revision graph" });
    await expect(graph.querySelectorAll("[data-revision-id]")).toHaveLength(4);
    await expect(canvas.queryByText("Loading repository log")).toBeNull();
    await userEvent.click(
      canvas.getByRole("link", { name: "Revision 5", exact: true }),
    );
    await waitFor(() =>
      expect(canvas.getByLabelText("Log address")).toHaveTextContent(
        `/log/${replayCommit(5)}`,
      ),
    );
    await expect(await canvas.findByText("00000000.md")).toBeVisible();
  }}
>
  {#snippet template()}
    <Harness
      deferHistory
      initialCommit={replayCommit(6)}
      historyEvents={rewrittenMergeEvents}
    />
  {/snippet}
</Story>

<Story
  name="Shared ancestor through empty parents"
  play={async ({ canvas }) => {
    const graph = await canvas.findByRole("list", { name: "Revision graph" });
    await expect(graph.querySelectorAll("[data-revision-id]")).toHaveLength(2);
    await expect(
      canvas.getByRole("link", { name: "Revision 1", exact: true }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: "Revision 6", exact: true }),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <Harness initialCommit={replayCommit(6)} historyEvents={emptyMergeEvents} />
  {/snippet}
</Story>
