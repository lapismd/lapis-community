import { describe, expect, it } from "vitest";

import type { NostrEvent } from "../protocol/index.js";
import { buildRepositoryLog } from "./repository-log.js";
import {
  KIND_JJ_OPERATION_GRAPH,
  KIND_JJ_REVISION,
  KIND_JJ_VIEW,
} from "./work-item-filters.js";

const owner = "1".repeat(64);
const parent = "a".repeat(40);
const left = "b".repeat(40);
const right = "c".repeat(40);
const merge = "d".repeat(40);
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
    ...extras,
  });
}

describe("repository log change collapse", () => {
  it("keeps a completed checkpoint over its unnamed snapshot with the same author time", () => {
    const change = "c".repeat(32);
    const snapshot = "f".repeat(40);
    const completed = "1".repeat(40);
    const working = "e".repeat(40);
    const graph = buildRepositoryLog([
      revision("1", 10, parent, [], "root"),
      revision("2", 11, snapshot, [parent], "", {
        change_id_hex: change,
        committer: { timestamp_ms: 11_000 },
      }),
      revision("3", 11, completed, [parent], "docs: completed README", {
        change_id_hex: change,
        committer: { timestamp_ms: 11_500 },
      }),
      revision("4", 12, working, [completed], "", {
        facts: { is_empty: true },
      }),
      view("5", 13, [working]),
    ]);
    expect(graph.revisions.map((item) => item.eventId)).toEqual([
      working,
      completed,
      parent,
    ]);
    expect(graph.revisions[1]?.createdAt).toBe(11);
    expect(graph.revisions[0]?.parents).toEqual([completed]);
  });

  it("keeps one row per change_id when a merge is republished", () => {
    const change = "c".repeat(32);
    const older = "9".repeat(40);
    const graph = buildRepositoryLog([
      revision("1", 10, parent, [], "root"),
      revision("2", 11, left, [parent], "lane a"),
      revision("3", 12, right, [parent], "lane b"),
      revision("7", 12, older, [left, right], "merge lane A and lane B", {
        change_id_hex: change,
      }),
      revision("4", 13, merge, [left, right], "record merged lanes", {
        change_id_hex: change,
      }),
      view("6", 14, [merge], {
        local_bookmarks: [
          { name: "main", target: { state: "resolved", commit_id: merge } },
        ],
        workspaces: [
          { native_workspace_name: "default", working_copy_commit_id: merge },
        ],
      }),
    ]);
    expect(graph.revisions.map((item) => item.eventId)).toEqual([
      merge,
      right,
      left,
      parent,
    ]);
    expect(
      graph.revisions.some((item) => item.message.includes("merge lane")),
    ).toBe(false);
    expect(
      graph.devices.every((device) => device.revisionEventId === merge),
    ).toBe(true);
  });

  it("rewrites parents through a dropped same-change snapshot", () => {
    const change = "c".repeat(32);
    const older = "9".repeat(40);
    const child = "8".repeat(40);
    const graph = buildRepositoryLog([
      revision("1", 10, parent, [], "root"),
      revision("7", 12, older, [parent], "old merge", {
        change_id_hex: change,
      }),
      revision("4", 13, merge, [parent], "record merged lanes", {
        change_id_hex: change,
      }),
      revision("8", 14, child, [older], "follow-up"),
      view("6", 15, [child]),
    ]);
    expect(
      graph.revisions.find((item) => item.eventId === child)?.parents,
    ).toEqual([merge]);
  });

  it("omits abandoned empty working copies that jj log would hide", () => {
    const abandoned = "e".repeat(40);
    const graph = buildRepositoryLog([
      revision("1", 10, parent, [], "root"),
      revision("4", 13, merge, [parent], "record merged lanes"),
      revision("8", 14, abandoned, [merge], "", { facts: { is_empty: true } }),
      view("6", 15, [merge], {
        local_bookmarks: [
          { name: "main", target: { state: "resolved", commit_id: merge } },
        ],
        workspaces: [
          { native_workspace_name: "default", working_copy_commit_id: merge },
        ],
      }),
    ]);
    expect(graph.revisions.map((item) => item.eventId)).toEqual([
      merge,
      parent,
    ]);
    expect(graph.revisions.some((item) => item.empty)).toBe(false);
  });

  it("keeps the current empty working copy when the pinned view names it", () => {
    const working = "e".repeat(40);
    const graph = buildRepositoryLog([
      revision("1", 10, parent, [], "root"),
      revision("4", 13, merge, [parent], "record merged lanes"),
      revision("8", 14, working, [merge], "", { facts: { is_empty: true } }),
      view("6", 15, [working], {
        local_bookmarks: [
          { name: "main", target: { state: "resolved", commit_id: merge } },
        ],
        workspaces: [
          { native_workspace_name: "default", working_copy_commit_id: working },
        ],
      }),
    ]);
    expect(graph.revisions.map((item) => item.eventId)).toEqual([
      working,
      merge,
      parent,
    ]);
    expect(
      graph.revisions.find((item) => item.eventId === working)?.empty,
    ).toBe(true);
  });

  it("keeps the rewrite named by the current view when author times tie", () => {
    const change = "c".repeat(32);
    const older = "d".repeat(40);
    const current = "8".repeat(40);
    const graph = buildRepositoryLog([
      revision("1", 10, parent, [], "root"),
      revision("7", 13, older, [parent], "merge lane A and lane B", {
        change_id_hex: change,
      }),
      revision("4", 13, current, [parent], "record merged lanes", {
        change_id_hex: change,
      }),
      view("6", 14, [current], {
        local_bookmarks: [
          { name: "demo", target: { state: "resolved", commit_id: current } },
        ],
        workspaces: [
          {
            native_workspace_name: "default",
            working_copy_commit_id: current,
          },
        ],
      }),
    ]);
    expect(graph.revisions.map((item) => item.eventId)).toEqual([
      current,
      parent,
    ]);
    expect(graph.revisions[0]?.message).toBe("record merged lanes");
  });

  it("places @ on the empty working copy named by the latest native operation", () => {
    const current = "4".repeat(40);
    const abandoned = "6".repeat(40);
    const currentView = "1".repeat(128);
    const staleView = "2".repeat(128);
    const graph = buildRepositoryLog([
      revision("1", 10, parent, [], "root"),
      revision("4", 13, merge, [parent], "record merged lanes", {
        change_id_hex: "c".repeat(32),
      }),
      revision("7", 13, "9".repeat(40), [parent], "merge lane A and lane B", {
        change_id_hex: "c".repeat(32),
      }),
      revision("8", 14, abandoned, [merge], ""),
      revision("9", 15, current, [merge], ""),
      event("a", KIND_JJ_VIEW, 1700000000, {
        schema: "jj-sync/view",
        view_id: staleView,
        head_commit_ids: [abandoned],
        workspaces: [
          {
            native_workspace_name: "default",
            working_copy_commit_id: abandoned,
          },
        ],
      }),
      event("b", KIND_JJ_VIEW, 1700000000, {
        schema: "jj-sync/view",
        view_id: currentView,
        head_commit_ids: [current],
        local_bookmarks: [
          { name: "demo", target: { state: "resolved", commit_id: merge } },
        ],
        workspaces: [
          { native_workspace_name: "default", working_copy_commit_id: current },
        ],
      }),
      event("c", KIND_JJ_OPERATION_GRAPH, 1700000000, {
        schema: "jj-sync/operation-graph",
        view_id: currentView,
        metadata: { ended_at_ms: 200, started_at_ms: 199 },
      }),
      event("d", KIND_JJ_OPERATION_GRAPH, 1700000000, {
        schema: "jj-sync/operation-graph",
        view_id: staleView,
        metadata: { ended_at_ms: 100, started_at_ms: 99 },
      }),
    ]);
    expect(graph.revisions.map((item) => item.eventId)).toEqual([
      current,
      merge,
      parent,
    ]);
    expect(
      graph.devices.find((device) => device.alias === "@")?.revisionEventId,
    ).toBe(current);
    expect(
      graph.devices.find((device) => device.alias === "demo")?.revisionEventId,
    ).toBe(merge);
    expect(
      graph.revisions.some((item) => item.message.includes("merge lane")),
    ).toBe(false);
  });
});
