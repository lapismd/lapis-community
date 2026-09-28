import { describe, expect, it } from "vitest";

import type { RepositoryLogRevision } from "./repository-log.js";
import {
  REPOSITORY_LOG_ROW_HEIGHT,
  buildRepositoryLogGraph,
  repositoryLogLaneStem,
} from "./repository-log-graph.js";

function revision(eventId: string, parents: string[]): RepositoryLogRevision {
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
  };
}

describe("repository log graph lane stability", () => {
  it("keeps an unrelated outer lane connected while an inner fork converges", () => {
    const rows = buildRepositoryLogGraph([
      revision("rev-merge", ["rev-left", "rev-right"]),
      revision("rev-outer", ["rev-shared"]),
      revision("rev-right", ["rev-base"]),
      revision("rev-left", ["rev-base"]),
      revision("rev-base", ["rev-shared"]),
      revision("rev-shared", ["rev-root"]),
      revision("rev-root", []),
    ]);
    const base = rows.find((row) => row.revision.eventId === "rev-base");
    const shared = rows.find((row) => row.revision.eventId === "rev-shared");

    expect(base?.lanes[2]?.hash).toBe("rev-shared");
    expect(shared?.lanes[2]?.hash).toBe("rev-shared");
    expect(shared?.convergingLanes).toEqual([2]);
    expect(repositoryLogLaneStem(base!, 2).y2).toBe(REPOSITORY_LOG_ROW_HEIGHT);
    expect(repositoryLogLaneStem(shared!, 2).y1).toBe(0);
  });
});
