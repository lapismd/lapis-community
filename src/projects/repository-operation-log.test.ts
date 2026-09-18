import { describe, expect, it } from "vitest";

import type { NostrEvent } from "../protocol/index.js";
import { buildRepositoryOperationLog } from "./repository-operation-log.js";
import {
  KIND_JJ_GRAPH_MANIFEST,
  KIND_JJ_OPERATION_GRAPH,
  KIND_JJ_REVISION,
} from "./work-item-filters.js";

const owner = "1".repeat(64);
const parentOp = "a".repeat(128);
const childOp = "b".repeat(128);
const laterOp = "c".repeat(128);

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

function operation(
  id: string,
  createdAt: number,
  operationId: string,
  parents: string[],
  description: string,
  endedAtMs: number,
): NostrEvent {
  return event(id, KIND_JJ_OPERATION_GRAPH, createdAt, {
    schema: "jj-sync/operation-graph",
    operation_id: operationId,
    parent_operation_ids: parents,
    metadata: {
      description,
      started_at_ms: endedAtMs - 10,
      ended_at_ms: endedAtMs,
    },
  });
}

describe("buildRepositoryOperationLog", () => {
  it("projects 3904 operation-parent edges and ignores commit parents", () => {
    const graph = buildRepositoryOperationLog([
      event("1", KIND_JJ_REVISION, 10, {
        schema: "jj-sync/revision",
        commit_id: "d".repeat(40),
        parent_commit_ids: ["e".repeat(40)],
        description: "not an operation",
      }),
      operation("2", 11, parentOp, [], "snapshot", 1_000),
      operation("3", 12, childOp, [parentOp], "new empty commit", 2_000),
    ]);
    expect(graph.revisions.map((item) => item.eventId)).toEqual([
      childOp,
      parentOp,
    ]);
    expect(graph.revisions[0]?.parents).toEqual([parentOp]);
    expect(graph.revisions[0]?.message).toBe("new empty commit");
    expect(graph.devices[0]).toMatchObject({
      alias: "@",
      revisionEventId: childOp,
    });
  });

  it("pins the tip chip from the latest 3905 context operation", () => {
    const graph = buildRepositoryOperationLog([
      operation("2", 11, parentOp, [], "older", 3_000),
      operation("3", 12, laterOp, [parentOp], "newer", 4_000),
      event("4", KIND_JJ_GRAPH_MANIFEST, 20, {
        schema: "jj-sync/graph-publication",
        context: { operation_id: parentOp, view_id: "f".repeat(128) },
      }),
    ]);
    expect(graph.devices[0]?.revisionEventId).toBe(parentOp);
  });

  it("exposes a dest-Git commit from recorded evolution entries", () => {
    const commitId = "d".repeat(40);
    const graph = buildRepositoryOperationLog([
      event("3", KIND_JJ_OPERATION_GRAPH, 12, {
        schema: "jj-sync/operation-graph",
        operation_id: childOp,
        parent_operation_ids: [parentOp],
        metadata: {
          description: "record merged lanes",
          started_at_ms: 1_990,
          ended_at_ms: 2_000,
        },
        evolution: {
          recording: "recorded",
          entries: [{ commit_id: commitId, predecessor_commit_ids: [] }],
        },
      }),
    ]);
    expect(graph.revisions[0]?.commitId).toBe(commitId);
    expect(graph.revisions[0]?.empty).toBe(false);
  });

  it("returns an empty graph when no 3904 events are published", () => {
    expect(
      buildRepositoryOperationLog([
        event("4", KIND_JJ_GRAPH_MANIFEST, 20, {
          schema: "jj-sync/graph-publication",
          context: { operation_id: parentOp, view_id: "f".repeat(128) },
        }),
      ]),
    ).toEqual({ revisions: [], devices: [] });
  });
});
