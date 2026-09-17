import { describe, expect, it } from "vitest";

import type { NostrEvent } from "../protocol/index.js";
import {
  REPOSITORY_LOG_EMPTY_DESCRIPTION,
  buildRepositoryLog,
} from "./repository-log.js";
import {
  KIND_JJ_GRAPH_MANIFEST,
  KIND_JJ_OPERATION_GRAPH,
  KIND_JJ_REVISION,
  KIND_JJ_VIEW,
} from "./work-item-filters.js";

const owner = "1".repeat(64);
const parent = "a".repeat(40);
const left = "b".repeat(40);
const right = "c".repeat(40);
const merge = "d".repeat(40);
const hidden = "e".repeat(40);
const viewId = "f".repeat(128);

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
    parent_commit_ids: parents,
    description,
    author: {
      name: "Maya Chen",
      email: "maya@example.test",
      timestamp_ms: createdAt * 1_000,
    },
    ...extras,
  });
}

function view(
  id: string,
  createdAt: number,
  heads: string[],
  extras: Record<string, unknown> = {},
): NostrEvent {
  return event(id, KIND_JJ_VIEW, createdAt, {
    schema: "jj-sync/view",
    view_id: viewId,
    head_commit_ids: heads,
    local_bookmarks: [
      { name: "main", target: { state: "resolved", commit_id: merge } },
    ],
    workspaces: [
      { native_workspace_name: "default", working_copy_commit_id: merge },
    ],
    ...extras,
  });
}

describe("repository log", () => {
  it("maps visible 3902/3903 revisions onto a newest-first DAG", () => {
    const graph = buildRepositoryLog([
      revision("1", 10, parent, [], "root"),
      revision("2", 11, left, [parent], "lane a"),
      revision("3", 12, right, [parent], "lane b"),
      revision("4", 13, merge, [left, right], "record merged lanes"),
      revision("5", 9, hidden, [parent], "abandoned rewrite"),
      view("6", 14, [merge]),
    ]);
    expect(graph.revisions.map((item) => item.eventId)).toEqual([
      merge,
      right,
      left,
      parent,
    ]);
    expect(graph.revisions[0]).toMatchObject({
      parents: [left, right],
      reason: "merge",
      author: "Maya Chen",
      message: "record merged lanes",
      changeId: "",
    });
    expect(graph.revisions.some((item) => item.eventId === hidden)).toBe(false);
    expect(JSON.stringify(graph)).not.toContain("maya@example.test");
    expect(graph.devices.map((device) => device.alias).sort()).toEqual([
      "@",
      "main",
    ]);
    expect(
      graph.devices.every((device) => device.revisionEventId === merge),
    ).toBe(true);
  });

  it("reads change_id_hex from the revision body or i tag", () => {
    const hex = "0123456789abcdef0123456789abcdef";
    const tagged = revision("2", 11, left, [parent], "lane a");
    tagged.tags = [
      ["a", "30617:owner:probe"],
      ["i", "fedcba9876543210fedcba9876543210"],
    ];
    const graph = buildRepositoryLog([
      revision("1", 10, parent, [], "root", { change_id_hex: hex }),
      tagged,
      revision("4", 13, merge, [left], "head"),
      view("6", 14, [merge]),
    ]);
    expect(
      graph.revisions.find((item) => item.eventId === parent)?.changeId,
    ).toBe(hex);
    expect(
      graph.revisions.find((item) => item.eventId === left)?.changeId,
    ).toBe("fedcba9876543210fedcba9876543210");
  });

  it("keeps sibling lanes and earlier revisions when the newest view lists one head", () => {
    const graph = buildRepositoryLog([
      revision("1", 10, parent, [], "root"),
      revision("2", 11, left, [parent], "lane a"),
      revision("3", 12, right, [parent], "lane b"),
      revision("4", 13, merge, [left, right], "record merged lanes"),
      view("5", 13, [merge], { local_bookmarks: [] }),
      view("6", 14, [left], {
        local_bookmarks: [],
        workspaces: [
          { native_workspace_name: "default", working_copy_commit_id: left },
        ],
      }),
    ]);
    expect(graph.revisions.map((item) => item.eventId)).toEqual([
      merge,
      right,
      left,
      parent,
    ]);
    expect(graph.devices.map((device) => device.alias)).toEqual(["@"]);
    expect(graph.devices[0]?.revisionEventId).toBe(left);
  });

  it("prefers workspace chips from the view attached to the latest 3904/3905 context", () => {
    const olderView = view("6", 14, [merge]);
    const newerHeads = event("7", KIND_JJ_VIEW, 20, {
      schema: "jj-sync/view",
      view_id: "9".repeat(128),
      head_commit_ids: [parent],
      local_bookmarks: [],
      workspaces: [
        { native_workspace_name: "default", working_copy_commit_id: parent },
      ],
    });
    const graph = buildRepositoryLog([
      revision("1", 10, parent, [], "root"),
      revision("4", 13, merge, [parent], "later head"),
      olderView,
      newerHeads,
      event("8", KIND_JJ_OPERATION_GRAPH, 21, {
        schema: "jj-sync/operation-graph",
        view_id: viewId,
      }),
      event("9", KIND_JJ_GRAPH_MANIFEST, 22, {
        schema: "jj-sync/graph-publication",
        context: { view_id: viewId, operation_id: "o".repeat(128) },
      }),
    ]);
    expect(graph.revisions.map((item) => item.eventId)).toEqual([
      merge,
      parent,
    ]);
    expect(graph.devices.map((device) => device.alias).sort()).toEqual([
      "@",
      "main",
    ]);
    expect(
      graph.devices.find((device) => device.alias === "@")?.revisionEventId,
    ).toBe(merge);
  });

  it("uses jj empty-description text when the revision has no description", () => {
    const graph = buildRepositoryLog([
      revision("1", 10, parent, [], ""),
      revision("4", 13, merge, [parent], "described empty\nbody", {
        facts: { is_empty: true, has_conflict: false },
      }),
      view("6", 14, [merge]),
    ]);
    expect(
      graph.revisions.find((item) => item.eventId === parent)?.message,
    ).toBe(REPOSITORY_LOG_EMPTY_DESCRIPTION);
    expect(
      graph.revisions.find((item) => item.eventId === merge)?.message,
    ).toBe("(empty) described empty");
  });

  it("returns an empty graph when no view has been projected", () => {
    expect(buildRepositoryLog([revision("1", 10, parent, [], "root")])).toEqual(
      { revisions: [], devices: [] },
    );
  });
});
