import { describe, expect, it } from "vitest";
import {
  emptyMergeEvents,
  replayCommit,
  replayRevision,
  replayView,
  rewrittenMergeEvents,
} from "../testing/repository-log-replay-fixtures.js";
import { buildRepositoryLog } from "./repository-log.js";
import { buildRepositoryLogGraph } from "./repository-log-graph.js";

describe("repository log replay", () => {
  it("deduplicates merge parents after mapping same-change rewrites", () => {
    const input = structuredClone(rewrittenMergeEvents);
    const graph = buildRepositoryLog(input);
    expect(graph.revisions[0]?.parents).toEqual([
      replayCommit(2),
      replayCommit(5),
    ]);
    expect(buildRepositoryLogGraph(graph.revisions)[0]?.mergeFromLanes).toEqual(
      [1],
    );
    expect(graph.revisions.map((row) => row.eventId)).toEqual(
      [6, 5, 2, 1].map(replayCommit),
    );
    expect(input).toEqual(rewrittenMergeEvents);
    expect(buildRepositoryLog([...input].reverse())).toEqual(graph);
    expect(buildRepositoryLog([...input, ...input])).toEqual(graph);
  });

  it("deduplicates shared ancestors when bypassing empty merge parents", () => {
    const graph = buildRepositoryLog(emptyMergeEvents);
    expect(graph.revisions[0]?.parents).toEqual([replayCommit(1)]);
    expect(graph.revisions.map((row) => row.eventId)).toEqual(
      [6, 1].map(replayCommit),
    );
    expect(buildRepositoryLogGraph(graph.revisions)[0]?.mergeFromLanes).toEqual(
      [],
    );
  });

  it("spends the ancestor budget on unique revisions across repeated diamonds", () => {
    const events = [replayRevision(1, [])];
    let head = 1;
    for (let layer = 0; layer < 10; layer += 1) {
      events.push(
        replayRevision(head + 1, [head]),
        replayRevision(head + 2, [head]),
        replayRevision(head + 3, [head + 1, head + 2]),
      );
      head += 3;
    }
    events.push(replayView([head]));
    const graph = buildRepositoryLog(events);
    expect(graph.revisions).toHaveLength(31);
    expect(graph.revisions.at(-1)?.eventId).toBe(replayCommit(1));
    const positions = new Map(
      graph.revisions.map((row, i) => [row.eventId, i]),
    );
    for (const row of graph.revisions) {
      for (const parent of row.parents) {
        expect(positions.get(parent)).toBeGreaterThan(
          positions.get(row.eventId)!,
        );
      }
    }
  });
});
