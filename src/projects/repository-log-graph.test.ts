import { describe, expect, it } from "vitest";

import type { RepositoryLogRevision } from "./repository-log.js";
import {
  REPOSITORY_LOG_ROW_HEIGHT,
  buildRepositoryLogGraph,
  repositoryLogLaneStem,
  tipRevisionIds,
} from "./repository-log-graph.js";

function revision(
  eventId: string,
  parents: string[],
  extras: Partial<RepositoryLogRevision> = {},
): RepositoryLogRevision {
  return {
    eventId,
    parents,
    message: eventId,
    reason: parents.length > 1 ? "merge" : "checkpoint",
    createdAt: 1_700_000_000,
    root: eventId,
    author: "Maya Chen",
    ...extras,
  };
}

describe("repository log graph", () => {
  it("keeps a linear history on one lane", () => {
    const revisions = [revision("rev-b", ["rev-a"]), revision("rev-a", [])];
    const rows = buildRepositoryLogGraph(revisions);
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.lanes.length === 1)).toBe(true);
    expect(tipRevisionIds(revisions)).toEqual(["rev-b"]);
  });

  it("assigns a second lane for a forked head", () => {
    const revisions = [
      revision("rev-b", ["rev-a"]),
      revision("rev-c", ["rev-a"]),
      revision("rev-a", []),
    ];
    const rows = buildRepositoryLogGraph(revisions);
    expect(tipRevisionIds(revisions).sort()).toEqual(["rev-b", "rev-c"]);
    expect(Math.max(...rows.map((row) => row.lanes.length))).toBeGreaterThan(1);
    expect(
      rows.find((row) => row.revision.eventId === "rev-c")?.commitLane,
    ).not.toBe(
      rows.find((row) => row.revision.eventId === "rev-b")?.commitLane,
    );
  });

  it("attaches bookmark aliases to the target revision", () => {
    const rows = buildRepositoryLogGraph(
      [revision("rev-c", ["rev-a"]), revision("rev-a", [])],
      [
        {
          publicKey: "1".repeat(64),
          alias: "main",
          revisionEventId: "rev-c",
          lastSeen: 10,
        },
      ],
    );
    expect(
      rows.find((row) => row.revision.eventId === "rev-c")?.deviceAliases,
    ).toEqual(["main"]);
  });

  it("keeps both fork tips visible on separate lanes", () => {
    const rows = buildRepositoryLogGraph([
      revision("rev-laptop", ["rev-shared"]),
      revision("rev-main", ["rev-shared"]),
      revision("rev-shared", []),
    ]);
    const laptop = rows.find((row) => row.revision.eventId === "rev-laptop");
    const main = rows.find((row) => row.revision.eventId === "rev-main");
    expect(laptop?.isTip).toBe(true);
    expect(main?.isTip).toBe(true);
    expect(laptop?.commitLane).not.toBe(main?.commitLane);
    expect(repositoryLogLaneStem(laptop!, laptop!.commitLane).y2).toBe(
      REPOSITORY_LOG_ROW_HEIGHT,
    );
  });

  it("records merge-from lanes for a two-parent revision", () => {
    const rows = buildRepositoryLogGraph([
      revision("rev-merge", ["rev-left", "rev-right"]),
      revision("rev-left", ["rev-root"]),
      revision("rev-right", ["rev-root"]),
      revision("rev-root", []),
    ]);
    const merge = rows.find((row) => row.revision.eventId === "rev-merge");
    expect(merge?.mergeFromLanes.length).toBeGreaterThan(0);
    expect(Math.max(...rows.map((row) => row.lanes.length))).toBeGreaterThan(1);
  });
});
