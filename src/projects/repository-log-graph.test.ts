import { describe, expect, it } from "vitest";

import type { RepositoryLogRevision } from "./repository-log.js";
import {
  REPOSITORY_LOG_ROW_HEIGHT,
  buildRepositoryLogGraph,
  encodeJjChangeId,
  repositoryLogConvergePath,
  repositoryLogLaneStem,
  repositoryLogLaneX,
  repositoryLogMergePath,
  repositoryLogRowLabel,
  repositoryLogSplitPath,
  shortestRepositoryLogPrefix,
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
    changeId: "",
    author: "Maya Chen",
    empty: false,
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

  it("reconnects a forked lane at the shared parent", () => {
    const rows = buildRepositoryLogGraph([
      revision("rev-wc", ["rev-b"]),
      revision("rev-a", ["rev-shared"]),
      revision("rev-b", ["rev-shared"]),
      revision("rev-shared", []),
    ]);
    const side = rows.find((row) => row.revision.eventId === "rev-a");
    const sibling = rows.find((row) => row.revision.eventId === "rev-b");
    const parent = rows.find((row) => row.revision.eventId === "rev-shared");
    expect(side?.commitLane).toBe(1);
    expect(sibling?.lanes).toHaveLength(2);
    expect(parent?.lanes).toHaveLength(2);
    expect(parent?.commitLane).toBe(0);
    expect(parent?.convergingLanes).toEqual([1]);
    expect(repositoryLogLaneStem(parent!, parent!.convergingLanes[0]!).y2).toBe(
      0,
    );
    expect(
      repositoryLogConvergePath(repositoryLogLaneX(1), repositoryLogLaneX(0)),
    ).toBe(
      `M ${repositoryLogLaneX(1)} 0 C ${repositoryLogLaneX(1)} 10, ${repositoryLogLaneX(0)} ${REPOSITORY_LOG_ROW_HEIGHT / 2 - 10}, ${repositoryLogLaneX(0)} ${REPOSITORY_LOG_ROW_HEIGHT / 2}`,
    );
    expect(
      repositoryLogSplitPath(repositoryLogLaneX(0), repositoryLogLaneX(1)),
    ).toContain(`${REPOSITORY_LOG_ROW_HEIGHT - 10}`);
    expect(
      repositoryLogMergePath(repositoryLogLaneX(0), repositoryLogLaneX(1)),
    ).toContain(`${REPOSITORY_LOG_ROW_HEIGHT / 2 + 6}`);
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

  it("encodes change IDs with jj reverse-hex and lengthens prefixes on collision", () => {
    expect(encodeJjChangeId("0123456789abcdef0123456789abcdef")).toBe(
      "zyxwvutsrqponmlkzyxwvutsrqponmlk",
    );
    expect(
      shortestRepositoryLogPrefix(["zyxwvutskkkkkkkk", "zyxwvutsrrrrrrrr"]).get(
        "zyxwvutskkkkkkkk",
      ),
    ).toBe("zyxwvutsk");
    const rows = buildRepositoryLogGraph([
      revision("dddddddddddddddddddddddddddddddddddddddd", [], {
        changeId: "0123456789abcdef0123456789abcdef",
        message: "record merged lanes",
      }),
    ]);
    expect(rows[0]?.changeIdShort).toBe("zyxwvuts");
    expect(rows[0]?.commitIdShort).toBe("dddddddd");
    expect(repositoryLogRowLabel(rows[0]!)).toContain("zyxwvuts");
    expect(repositoryLogRowLabel(rows[0]!)).toContain("dddddddd");
  });
});
