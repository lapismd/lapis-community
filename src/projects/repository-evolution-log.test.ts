import { describe, expect, it } from "vitest";

import type { NostrEvent } from "../protocol/index.js";
import { REPOSITORY_LOG_EMPTY_DESCRIPTION } from "./repository-log.js";
import { buildRepositoryEvolutionLog } from "./repository-evolution-log.js";
import {
  KIND_JJ_OPERATION_GRAPH,
  KIND_JJ_REVISION,
} from "./work-item-filters.js";

const owner = "1".repeat(64);
const current = "b".repeat(40);
const predecessor = "a".repeat(40);
const codeParent = "c".repeat(40);
const changeId = "4".repeat(32);

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
    change_id_hex: changeId,
    parent_commit_ids: parents,
    description,
    author: { name: "Maya Chen", timestamp_ms: createdAt * 1_000 },
    ...extras,
  });
}

function operation(
  id: string,
  recording: "recorded" | "unavailable",
  entries: { commit_id: string; predecessor_commit_ids: string[] }[] | null,
): NostrEvent {
  return event(id, KIND_JJ_OPERATION_GRAPH, 20, {
    schema: "jj-sync/operation-graph",
    operation_id: id.repeat(128).slice(0, 128),
    evolution: {
      recording,
      evidence_model: "operation-native",
      entries,
    },
  });
}

describe("buildRepositoryEvolutionLog", () => {
  it("walks recorded 3904 predecessors and ignores commit parents", () => {
    const graph = buildRepositoryEvolutionLog(
      [
        revision("1", 10, predecessor, [], "first version"),
        revision("2", 11, current, [codeParent], "rewritten"),
        operation("3", "recorded", [
          { commit_id: current, predecessor_commit_ids: [predecessor] },
        ]),
      ],
      current,
      changeId,
    );
    expect(graph.revisions.map((item) => item.eventId)).toEqual([
      current,
      predecessor,
    ]);
    expect(graph.revisions[0]?.parents).toEqual([predecessor]);
    expect(graph.revisions[0]?.parents).not.toContain(codeParent);
    expect(graph.revisions[1]?.message).toBe("first version");
  });

  it("returns empty when recording is unavailable and no other versions exist", () => {
    expect(
      buildRepositoryEvolutionLog(
        [
          revision("2", 11, current, [codeParent], "rewritten"),
          operation("3", "unavailable", null),
        ],
        current,
        changeId,
      ),
    ).toEqual({ revisions: [], devices: [] });
  });

  it("stubs a predecessor that has no published 3902", () => {
    const graph = buildRepositoryEvolutionLog(
      [
        revision("2", 11, current, [], "rewritten"),
        operation("3", "recorded", [
          { commit_id: current, predecessor_commit_ids: [predecessor] },
        ]),
      ],
      current,
    );
    expect(graph.revisions.map((item) => item.eventId)).toEqual([
      current,
      predecessor,
    ]);
    expect(
      graph.revisions.find((item) => item.eventId === predecessor)?.message,
    ).toBe(REPOSITORY_LOG_EMPTY_DESCRIPTION);
  });

  it("returns empty when the walk has only the selected commit", () => {
    expect(
      buildRepositoryEvolutionLog(
        [
          revision("2", 11, current, [], "rewritten"),
          operation("3", "recorded", [
            { commit_id: current, predecessor_commit_ids: [] },
          ]),
        ],
        current,
        changeId,
      ),
    ).toEqual({ revisions: [], devices: [] });
  });
});
