<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, waitFor, within } from "storybook/test";

  import CommunityProjectsRepositoryLogHarness from "./CommunityProjectsRepositoryLogHarness.svelte";
  import {
    parent,
    left,
    merge,
    operation,
    events,
  } from "./repository-log-story-fixtures.js";

  const { Story } = defineMeta({
    title: "Community/Projects/Repository Log",
    component: CommunityProjectsRepositoryLogHarness,
    tags: ["visual-pending"],
    parameters: {
      layout: "fullscreen",
      communityAppShell: true,
      docs: {
        source: {
          language: "svelte",
          code: `<CommunityProjects view="log" {workItemEvents} />`,
        },
        description: {
          component:
            "Repository Log maps jj-sync kinds 3902–3905 onto CommunityProjectsRevisionGraph, with a selectable Log/Op Log rail and a selection-gated Evolog column.",
        },
      },
    },
    args: {
      events,
      canMaintain: true,
      onCreateReview: fn(),
      onLoadRepositoryCommit: async (sha: string) => {
        if (sha === left || sha === parent) {
          throw new Error("git_object_not_found");
        }
        return {
          commit: { sha, subject: "record merged lanes" },
          stats: [{ path: "lanes.md", additions: 3, deletions: 1 }],
          patch: [
            "diff --git a/lanes.md b/lanes.md",
            "--- a/lanes.md",
            "+++ b/lanes.md",
            "@@ -1 +1 @@",
            "-old lane",
            "+merged-lane-marker",
          ].join("\n"),
        };
      },
    },
  });
</script>

<Story
  name="Projected Jujutsu DAG"
  play={async ({ canvas }) => {
    await expect(
      canvas.getByRole("region", { name: "Repository log" }),
    ).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Log" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(
      canvas.queryByRole("button", { name: "Add repository" }),
    ).toBeNull();
    await expect(canvas.queryByRole("button", { name: "Evolog" })).toBeNull();
    await expect(
      canvas.getByRole("list", { name: "Revision graph" }),
    ).toBeVisible();
    await expect(canvas.getByText("record merged lanes")).toBeVisible();
    await expect(canvas.queryByText("merge lane A and lane B")).toBeNull();
    const graph = canvas.getByRole("list", { name: "Revision graph" });
    const log =
      graph.closest("[aria-label='Repository log']") ??
      canvas.getByRole("region", { name: "Repository log" });
    await waitFor(() => {
      expect(
        log.querySelector(
          "[data-ui-part='column-body'] [data-ui-component='scroll-area']",
        ),
        "repository log scroll area",
      ).not.toBeNull();
    });
    await expect(
      log.querySelector("[data-ui-part='column-body']")?.contains(graph),
    ).toBe(true);
    await expect(
      (log
        .querySelector("[data-ui-part='column-header']")
        ?.getBoundingClientRect().height ?? 0) < 56,
    ).toBe(true);
    await expect(canvas.getByText("lane a")).toBeVisible();
    await expect(canvas.getByText("lane b")).toBeVisible();
    await expect(canvas.getByText("main")).toBeVisible();
    await expect(canvas.getByText("@")).toBeVisible();
    await expect(
      canvas.getByText("(empty) (no description set)"),
    ).toBeVisible();
    await expect(
      canvas.getAllByRole("button", { name: /Copy full change ID/ }).length,
    ).toBeGreaterThan(0);
    await expect(
      canvas.getAllByRole("button", { name: /Copy full commit ID/ }).length,
    ).toBeGreaterThan(0);
    await expect(canvas.queryByText("maya@example.test")).toBeNull();
    await expect(canvas.queryByText("Maya Chen")).toBeNull();
    await expect(canvas.queryByText("Snapshot", { exact: true })).toBeNull();
    const author = await waitFor(() => {
      const trigger = graph.querySelector("[data-ui-part='git-author']");
      expect(
        trigger?.querySelector("img[src*='gravatar.com/avatar/']"),
        "git author Gravatar",
      ).not.toBeNull();
      return trigger as HTMLElement;
    });
    await expect(
      graph.querySelector("time[datetime]"),
      "revision relative time",
    ).not.toBeNull();
    await userEvent.hover(author);
    await expect(author).toHaveAttribute("data-state", "instant-open");
    await expect(author).toHaveAttribute("aria-describedby");
    await userEvent.unhover(author);
    const mergeRow = graph.querySelector<HTMLElement>(
      `[data-revision-id="${merge}"]`,
    );
    if (!mergeRow) {
      throw new Error(
        `Missing merge row; rendered revision IDs: ${[
          ...graph.querySelectorAll("[data-revision-id]"),
        ]
          .map((row) => row.getAttribute("data-revision-id"))
          .join(", ")}`,
      );
    }
    await userEvent.click(mergeRow!);
    await expect(
      await canvas.findByRole("region", { name: "Agent context" }),
    ).toBeVisible();
    const checkpoint = canvas.getByLabelText("Code checkpoint");
    expect(checkpoint).toHaveAttribute("data-variant", "divider");
    await userEvent.click(
      canvas.getByRole("button", { name: "Collapse Agent context column" }),
    );
    expect(
      canvas.queryByText("Merged both lanes and published the checkpoint."),
    ).not.toBeInTheDocument();
    await userEvent.click(
      canvas.getByRole("button", { name: "Expand Agent context column" }),
    );
    const promptEmphasis = canvas.getByText("merge the lanes");
    await expect(promptEmphasis).toBeVisible();
    await expect(promptEmphasis.tagName).toBe("STRONG");
    await expect(canvas.getByText("apply_patch")).toBeVisible();
    await expect(
      canvas.getByText("Merged both lanes and published the checkpoint."),
    ).toBeVisible();
    await expect(canvas.getByText("Incomplete")).toBeVisible();
    await expect(canvas.queryByText("secret tool arguments")).toBeNull();
    const changedFiles = await canvas.findByRole("region", {
      name: "Changed files",
    });
    await expect(changedFiles).toBeVisible();
    const headerReview = within(changedFiles).getByRole("button", {
      name: "Create review",
    });
    await expect(headerReview).toBeVisible();
    await userEvent.click(headerReview);
    await expect(
      canvas.getByRole("heading", { name: "Create review" }),
    ).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect(
      canvas.getByRole("group", { name: "File listing view mode" }),
    ).toBeVisible();
    await expect(await canvas.findByText("lanes.md")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "lanes.md" }));
    await expect(
      canvas.getByRole("region", { name: "Column canvas" }),
    ).toBeVisible();
    await waitFor(() => {
      expect(
        canvas
          .getByRole("region", { name: "Repository log" })
          .querySelector("[data-diff-file-path='lanes.md']"),
      ).not.toBeNull();
    });
    const diffHeader = log.querySelector(
      "[data-column-id='diff'] [data-ui-part='column-header']",
    );
    await expect(diffHeader?.textContent).toContain("+3");
    await expect(diffHeader?.textContent).toContain("-1");
    const diffViewMode = canvas.getByRole("group", { name: "Diff view mode" });
    await expect(diffHeader?.contains(diffViewMode)).toBe(true);
    await expect(
      diffHeader?.contains(canvas.getByRole("button", { name: "Wrap text" })),
    ).toBe(true);
    await userEvent.click(
      canvas.getByRole("radio", { name: "Show split diff" }),
    );
    await waitFor(() => {
      expect(
        log.querySelector(
          "[data-ui-component='file-diff'][data-view-mode='split']",
        ),
      ).not.toBeNull();
    });
    await userEvent.click(canvas.getByRole("button", { name: "Wrap text" }));
    await waitFor(() => {
      expect(
        log.querySelector("[data-ui-component='file-diff'][data-wrap='true']"),
      ).not.toBeNull();
    });
    await expect((diffHeader?.getBoundingClientRect().height ?? 0) < 56).toBe(
      true,
    );
    await userEvent.click(
      canvas
        .getByText("(empty) (no description set)")
        .closest("[data-revision-id]")!,
    );
    await expect(await canvas.findByText("No changed files")).toBeVisible();
    await expect(canvas.queryByText("git_object_not_found")).toBeNull();
    await userEvent.click(
      canvas.getByText("lane a").closest("[data-revision-id]")!,
    );
    await expect(await canvas.findByText("No changed files")).toBeVisible();
    await expect(canvas.queryByText("git_object_not_found")).toBeNull();
    await userEvent.click(mergeRow!);
    await userEvent.click(
      await canvas.findByRole("button", { name: "Evolog" }),
    );
    await expect(
      canvas.getByRole("button", { name: "Evolog" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      canvas.getByRole("list", { name: "Evolution log" }),
    ).toBeVisible();
    await expect(canvas.getByText("merge lane A and lane B")).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Close Evolog column" }),
    );
    await expect(
      canvas.getByRole("button", { name: "Evolog" }),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(
      canvas.queryByRole("list", { name: "Evolution log" }),
    ).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Op Log" }));
    const operationGraph = canvas.getByRole("list", {
      name: "Operation graph",
    });
    await expect(operationGraph).toBeVisible();
    await expect(canvas.getByText("snapshot working copy")).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Evolog" })).toBeNull();
    await expect(
      canvas.getAllByRole("button", { name: /Copy full operation ID/ }).length,
    ).toBeGreaterThan(0);
    await expect(
      canvas.getByRole("button", { name: `Copy full commit ID: ${merge}` }),
    ).toBeVisible();
    const operationRow = operationGraph.querySelector<HTMLElement>(
      `[data-revision-id="${operation}"]`,
    );
    await expect(operationRow).not.toBeNull();
    await userEvent.click(operationRow!);
    await expect(
      await canvas.findByRole("region", { name: "Agent context" }),
    ).toBeVisible();
    await expect(await canvas.findByText("lanes.md")).toBeVisible();
  }}
/>
