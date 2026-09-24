import type { NostrEvent } from "../protocol/index.js";

export const replayCommit = (id: number): string =>
  id.toString(16).padStart(40, "0");

export function replayRevision(
  id: number,
  parents: number[],
  extras: Record<string, unknown> = {},
): NostrEvent {
  return replayEvent(id, 3902, {
    schema: "jj-sync/revision",
    commit_id: replayCommit(id),
    change_id_hex: id.toString(16).padStart(32, "0"),
    parent_commit_ids: parents.map(replayCommit),
    description: `Revision ${id}`,
    author: { name: "Maya Chen", timestamp_ms: id * 1_000 },
    ...extras,
  });
}

export function replayView(heads: number[]): NostrEvent {
  return replayEvent(1_000, 3903, {
    schema: "jj-sync/view",
    view_id: "f".repeat(128),
    head_commit_ids: heads.map(replayCommit),
    local_bookmarks: heads.map((id) => ({
      name: `head-${id}`,
      target: { state: "resolved", commit_id: replayCommit(id) },
    })),
    workspaces: [
      {
        native_workspace_name: "default",
        working_copy_commit_id: replayCommit(heads[0]!),
      },
    ],
  });
}

function replayEvent(id: number, kind: number, content: unknown): NostrEvent {
  return {
    id: id.toString(16).padStart(64, "0"),
    kind,
    pubkey: "1".repeat(64),
    created_at: id,
    tags: [["a", "30617:owner:probe"]],
    content: JSON.stringify(content),
    sig: "f".repeat(128),
  };
}

// Three native parents collapse to one visible change; one is the retained ID.
export const rewrittenMergeEvents = [
  replayRevision(1, []),
  replayRevision(2, [1]),
  replayRevision(3, [1], { change_id_hex: "a".repeat(32) }),
  replayRevision(4, [1], { change_id_hex: "a".repeat(32) }),
  replayRevision(5, [1], { change_id_hex: "a".repeat(32) }),
  replayRevision(6, [2, 3, 5, 4]),
  replayView([6]),
];

export const emptyMergeEvents = [
  replayRevision(1, []),
  replayRevision(2, [1], { is_empty: true }),
  replayRevision(3, [1], { is_empty: true }),
  replayRevision(4, [1], { is_empty: true }),
  replayRevision(6, [2, 3, 4]),
  replayView([6]),
];
