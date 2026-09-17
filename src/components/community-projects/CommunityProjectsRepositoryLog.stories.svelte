<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect } from "storybook/test";

  import type { NostrEvent } from "../../protocol/index.js";
  import {
    KIND_JJ_REVISION,
    KIND_JJ_VIEW,
  } from "../../projects/work-item-filters.js";
  import CommunityProjectsRepositoryLog from "./CommunityProjectsRepositoryLog.svelte";

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
  ): NostrEvent {
    return event(id, KIND_JJ_REVISION, createdAt, {
      schema: "jj-sync/revision",
      commit_id: commitId,
      change_id_hex: `${id}${"a".repeat(31)}`.slice(0, 32),
      parent_commit_ids: parents,
      description,
      author: { name: "Maya Chen", timestamp_ms: createdAt * 1_000 },
    });
  }

  const events = [
    revision("1", 10, parent, [], "root change"),
    revision("2", 11, left, [parent], "lane a"),
    revision("3", 12, right, [parent], "lane b"),
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
  ];

  const { Story } = defineMeta({
    title: "Community/Projects/Repository Log",
    component: CommunityProjectsRepositoryLog,
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
            "Repository Log maps jj-sync kinds 3902 and 3903 onto CommunityProjectsRevisionGraph.",
        },
      },
    },
    args: { events },
  });
</script>

<Story
  name="Projected Jujutsu DAG"
  play={async ({ canvas }) => {
    await expect(
      canvas.getByRole("region", { name: "Repository log" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("list", { name: "Revision graph" }),
    ).toBeVisible();
    await expect(canvas.getByText("record merged lanes")).toBeVisible();
    await expect(canvas.getByText("main")).toBeVisible();
    await expect(canvas.getByText("@")).toBeVisible();
    await expect(canvas.getByText("vppppppp")).toBeVisible();
    await expect(canvas.getByText(merge.slice(0, 8))).toBeVisible();
    await expect(canvas.queryByText("maya@example.test")).toBeNull();
  }}
/>
