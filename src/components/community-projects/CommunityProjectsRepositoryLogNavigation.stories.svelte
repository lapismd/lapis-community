<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor, within } from "storybook/test";
  import CommunityProjectsRepositoryLog from "./CommunityProjectsRepositoryLog.svelte";
  import Harness from "./CommunityProjectsRepositoryLogNavigationHarness.svelte";
  import { merge, left, events } from "./repository-log-story-fixtures.js";
  const longHistory = (() => {
    let parent = merge;
    const revisions = Array.from({ length: 50 }, (_, index) => {
      const commit = (index + 1).toString(16).padStart(40, "0");
      const revision = {
        ...events[0]!,
        id: commit.padStart(64, "0"),
        created_at: 100 + index,
        content: JSON.stringify({
          ...JSON.parse(events[0]!.content),
          commit_id: commit,
          change_id_hex: commit.slice(-32),
          parent_commit_ids: [parent],
          description: `Later commit ${index}`,
        }),
      };
      parent = commit;
      return revision;
    });
    return [
      ...events.map((event) =>
        event.kind === 3903
          ? {
              ...event,
              content: JSON.stringify({
                ...JSON.parse(event.content),
                head_commit_ids: [parent],
              }),
            }
          : event,
      ),
      ...revisions,
    ];
  })();
  const { Story } = defineMeta({
    title: "Community/Projects/Repository Log Navigation",
    component: CommunityProjectsRepositoryLog,
    tags: ["visual-pending"],
    parameters: {
      docs: {
        source: {
          code: '<CommunityProjects view="log" {workItemEvents} />',
          language: "svelte",
        },
      },
    },
  });
</script>

<Story
  name="Revision arrives before repository source"
  play={async ({ canvas }) => {
    await expect(
      await canvas.findByRole("link", { name: "record merged lanes" }),
    ).toBeVisible();
    await expect(
      canvas.queryByText("Repository source is not ready"),
    ).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Load history" }));
    await expect(await canvas.findByText("dddddddd.md")).toBeVisible();
    await expect(
      canvas.queryByText("Repository source is not ready"),
    ).toBeNull();
  }}
>
  {#snippet template()}<Harness deferHistory historyBeforeReady />{/snippet}
</Story>

<Story
  name="Direct selection beyond first page"
  play={async ({ canvas }) => {
    const selected = await canvas.findByRole("link", {
      name: "record merged lanes",
    });
    await waitFor(() =>
      expect(selected.closest("li")).toHaveAttribute("aria-current", "true"),
    );
    await expect(await canvas.findByText("dddddddd.md")).toBeVisible();
    await expect(
      canvas
        .getByRole("list", { name: "Revision graph" })
        .querySelectorAll("[data-revision-id]").length,
    ).toBeGreaterThan(40);
  }}
>
  {#snippet template()}<Harness historyEvents={longHistory} />{/snippet}
</Story>

<Story
  name="Direct selection and history after loading"
  play={async ({ canvas }) => {
    await expect(canvas.getByText("Loading repository log")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Load history" }));
    const selected = await canvas.findByRole("link", {
      name: "record merged lanes",
    });
    await expect(selected).toHaveAttribute(
      "href",
      `#/projects/repository/30617:owner:probe/log/${merge}`,
    );
    await waitFor(() =>
      expect(selected.closest("li")).toHaveAttribute("aria-current", "true"),
    );
    await expect(await canvas.findByText("dddddddd.md")).toBeVisible();
    await expect(
      canvas.getByRole("region", { name: "Agent context" }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("link", { name: "lane a", exact: true }),
    );
    await expect(canvas.getByLabelText("Log address")).toHaveTextContent(
      `/log/${left}`,
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Back", exact: true }),
    );
    await waitFor(() =>
      expect(selected.closest("li")).toHaveAttribute("aria-current", "true"),
    );
    await expect(await canvas.findByText("dddddddd.md")).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Forward", exact: true }),
    );
    const leftLink = canvas.getByRole("link", { name: "lane a", exact: true });
    await waitFor(() =>
      expect(leftLink.closest("li")).toHaveAttribute("aria-current", "true"),
    );
    await userEvent.click(leftLink);
    await expect(canvas.getByLabelText("Log address")).toHaveTextContent(
      /^#\/projects\/repository\/30617:owner:probe\/log$/,
    );
    await expect(leftLink.closest("li")).not.toHaveAttribute("aria-current");
  }}
>
  {#snippet template()}<Harness deferHistory />{/snippet}
</Story>

<Story
  name="Exact historical rewrite"
  play={async ({ canvas }) => {
    const selected = await canvas.findByRole("link", {
      name: "merge lane A and lane B",
    });
    await waitFor(() =>
      expect(selected.closest("li")).toHaveAttribute("aria-current", "true"),
    );
    await expect(await canvas.findByText("99999999.md")).toBeVisible();
    await expect(
      canvas.queryByRole("link", { name: "record merged lanes" }),
    ).toBeNull();
  }}
>
  {#snippet template()}<Harness initialCommit={"9".repeat(40)} />{/snippet}
</Story>

<Story
  name="Missing exact commit"
  play={async ({ canvas }) => {
    await expect(
      await canvas.findByText(
        "This commit is not available in the repository log.",
      ),
    ).toBeVisible();
    await expect(canvas.getByLabelText("Log address")).toHaveTextContent(
      `/log/${"0".repeat(40)}`,
    );
    await expect(
      canvas.queryByRole("region", { name: "Changed files" }),
    ).toBeNull();
  }}
>
  {#snippet template()}<Harness initialCommit={"0".repeat(40)} />{/snippet}
</Story>

<Story
  name="Commit description copy controls remain independent"
  play={async ({ canvas }) => {
    const link = await canvas.findByRole("link", {
      name: "Follow checkpoint",
      exact: true,
    });
    const row = link.closest("li")!;
    await expect(row.querySelector("a button")).toBeNull();
    await userEvent.click(
      within(row).getByRole("button", {
        name: `Copy full commit ID: ${left}`,
        exact: true,
      }),
    );
    await expect(canvas.getByLabelText("Log address")).toHaveTextContent(
      `/log/${merge}`,
    );
    await userEvent.click(link);
    await expect(canvas.getByLabelText("Log address")).toHaveTextContent(
      /\/log$/,
    );
  }}
>
  {#snippet template()}
    <Harness
      historyEvents={events.map((event) => {
        const body = JSON.parse(event.content);
        return body.commit_id === merge
          ? {
              ...event,
              content: JSON.stringify({
                ...body,
                description: `Follow checkpoint ${left}`,
              }),
            }
          : event;
      })}
    />
  {/snippet}
</Story>
