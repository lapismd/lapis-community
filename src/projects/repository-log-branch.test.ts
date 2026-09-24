import { describe, expect, it } from "vitest";

import type { NostrEvent } from "../protocol/index.js";
import { buildRepositoryLog } from "./repository-log.js";
import { repositoryLogBranchSeed } from "./repository-log-branch.js";
import { KIND_JJ_REVISION, KIND_JJ_VIEW } from "./work-item-filters.js";

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
  });
}

function view(createdAt: number): NostrEvent {
  return event("6", KIND_JJ_VIEW, createdAt, {
    schema: "jj-sync/view",
    view_id: viewId,
    head_commit_ids: [merge],
    local_bookmarks: [
      { name: "main", target: { state: "resolved", commit_id: left } },
      {
        name: "feature/files",
        target: { state: "resolved", commit_id: merge },
      },
    ],
    workspaces: [
      { native_workspace_name: "default", working_copy_commit_id: merge },
    ],
  });
}

describe("repository log branch selection", () => {
  it("uses a selected branch seed instead of the latest view heads", () => {
    const graph = buildRepositoryLog(
      [
        revision("1", 10, parent, [], "root"),
        revision("2", 11, left, [parent], "main branch"),
        revision("3", 12, right, [parent], "feature branch"),
        revision("4", 13, merge, [left, right], "current sync head"),
        view(14),
      ],
      null,
      left,
    );

    expect(graph.revisions.map((item) => item.eventId)).toEqual([left, parent]);
    expect(graph.revisions.some((item) => item.eventId === merge)).toBe(false);
    expect(graph.devices.map((device) => device.alias)).toEqual(["main"]);
  });
  it("uses the current jj view instead of narrowing sync carrier refs", () => {
    const refs = [
      { name: "main", sha: left },
      { name: "jj-sync/scope/replica", sha: "9".repeat(40) },
    ];
    const syncSeed = repositoryLogBranchSeed(refs, "jj-sync/scope/replica");
    const graph = buildRepositoryLog(
      [
        revision("1", 10, parent, [], "root"),
        revision("2", 11, left, [parent], "main branch"),
        revision("3", 12, right, [parent], "feature branch"),
        revision("4", 13, merge, [left, right], "current sync head"),
        view(14),
      ],
      null,
      syncSeed,
    );

    expect(syncSeed).toBeUndefined();
    expect(graph.revisions.map((item) => item.eventId)).toEqual([
      merge,
      right,
      left,
      parent,
    ]);
  });
});
