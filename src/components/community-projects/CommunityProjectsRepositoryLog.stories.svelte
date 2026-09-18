<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor } from "storybook/test";

  import type { NostrEvent } from "../../protocol/index.js";
  import {
    KIND_JJ_GRAPH_MANIFEST,
    KIND_JJ_OPERATION_GRAPH,
    KIND_JJ_REVISION,
    KIND_JJ_VIEW,
  } from "../../projects/work-item-filters.js";
  import CommunityProjectsRepositoryLogHarness from "./CommunityProjectsRepositoryLogHarness.svelte";

  const owner = "1".repeat(64);
  const parent = "a".repeat(40);
  const left = "b".repeat(40);
  const right = "c".repeat(40);
  const merge = "d".repeat(40);

  function event(
    id: string,
    kind: number,
    createdAt: number,
    content: unknown,
  ): NostrEvent {
    return {
      id: id.repeat(64).slice(0, 64),
      kind,
      pubkey: owner,
      created_at: createdAt,
      tags: [["a", "30617:owner:probe"]],
      content: JSON.stringify(content),
      sig: "f".repeat(128),
    };
  }

  function revision(
    id: string,
    createdAt: number,
    commitId: string,
    parents: string[],
    description: string,
    extras: Record<string, unknown> = {},
  ): NostrEvent {
    return event(id, KIND_JJ_REVISION, createdAt, {
      schema: "jj-sync/revision",
      commit_id: commitId,
      change_id_hex: `${id}${"a".repeat(31)}`.slice(0, 32),
      parent_commit_ids: parents,
      description,
      author: { name: "Maya Chen", timestamp_ms: createdAt * 1_000 },
      ...extras,
    });
  }

  const events = [
    revision("1", 10, parent, [], ""),
    revision("2", 11, left, [parent], "lane a"),
    revision("3", 12, right, [parent], "lane b"),
    revision(
      "7",
      12,
      "9".repeat(40),
      [left, right],
      "merge lane A and lane B",
      {
        change_id_hex: "4".padEnd(32, "a"),
      },
    ),
    revision("4", 13, merge, [left, right], "record merged lanes"),
    event("5", KIND_JJ_VIEW, 14, {
      schema: "jj-sync/view",
      view_id: "f".repeat(128),
      head_commit_ids: [merge],
      local_bookmarks: [
        { name: "main", target: { state: "resolved", commit_id: merge } },
      ],
      workspaces: [
        { native_workspace_name: "default", working_copy_commit_id: merge },
      ],
    }),
    event("8", KIND_JJ_OPERATION_GRAPH, 15, {
      schema: "jj-sync/operation-graph",
      operation_id: "1".repeat(128),
      parent_operation_ids: [],
      view_id: "f".repeat(128),
      metadata: {
        description: "snapshot working copy",
        started_at_ms: 14_000,
        ended_at_ms: 15_000,
      },
      evolution: { recording: "recorded", entries: [] },
    }),
    event("9", KIND_JJ_OPERATION_GRAPH, 16, {
      schema: "jj-sync/operation-graph",
      operation_id: "2".repeat(128),
      parent_operation_ids: ["1".repeat(128)],
      view_id: "f".repeat(128),
      metadata: {
        description: "record merged lanes",
        started_at_ms: 15_000,
        ended_at_ms: 16_000,
      },
      evolution: {
        recording: "recorded",
        entries: [
          {
            commit_id: merge,
            predecessor_commit_ids: ["9".repeat(40)],
          },
        ],
      },
    }),
    event("a", KIND_JJ_GRAPH_MANIFEST, 17, {
      schema: "jj-sync/graph-publication",
      context: {
        operation_id: "2".repeat(128),
        view_id: "f".repeat(128),
      },
    }),
  ];

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
    const log = canvas.getByRole("region", { name: "Repository log" });
    const graph = canvas.getByRole("list", { name: "Revision graph" });
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
    await userEvent.click(
      canvas.getByRole("button", { name: /record merged lanes/ }),
    );
    await expect(
      await canvas.findByRole("region", { name: "Changed files" }),
    ).toBeVisible();
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
    await userEvent.click(
      canvas.getByRole("button", { name: /\(empty\) \(no description set\)/ }),
    );
    await expect(await canvas.findByText("No changed files")).toBeVisible();
    await expect(canvas.queryByText("git_object_not_found")).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: /lane a/ }));
    await expect(await canvas.findByText("No changed files")).toBeVisible();
    await expect(canvas.queryByText("git_object_not_found")).toBeNull();
    await userEvent.click(
      canvas.getByRole("button", { name: /record merged lanes/ }),
    );
    await userEvent.click(
      await canvas.findByRole("button", { name: "Evolog" }),
    );
    await expect(
      canvas.getByRole("list", { name: "Evolution log" }),
    ).toBeVisible();
    await expect(canvas.getByText("merge lane A and lane B")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Op Log" }));
    await expect(
      canvas.getByRole("list", { name: "Operation graph" }),
    ).toBeVisible();
    await expect(canvas.getByText("snapshot working copy")).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Evolog" })).toBeNull();
    await expect(
      canvas.getAllByRole("button", { name: /Copy full operation ID/ }).length,
    ).toBeGreaterThan(0);
  }}
/>
