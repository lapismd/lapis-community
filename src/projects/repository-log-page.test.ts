import { describe, expect, it } from "vitest";

import {
  REPOSITORY_LOG_PAGE_SIZE,
  nextRepositoryLogVisible,
  takeRepositoryLogPage,
} from "./repository-log-page.js";
import type {
  RepositoryLogGraph,
  RepositoryLogRevision,
} from "./repository-log.js";

function revision(id: string): RepositoryLogRevision {
  return {
    eventId: id,
    changeId: "",
    parents: [],
    message: id,
    reason: "checkpoint",
    createdAt: 1,
    root: id,
    author: "",
    empty: true,
  };
}

describe("repository log paging", () => {
  it("windows newest revisions and drops chips that left the page", () => {
    const graph: RepositoryLogGraph = {
      revisions: [revision("a"), revision("b"), revision("c")],
      devices: [
        { publicKey: "", alias: "@", revisionEventId: "a", lastSeen: 1 },
        { publicKey: "", alias: "demo", revisionEventId: "c", lastSeen: 1 },
      ],
    };
    expect(takeRepositoryLogPage(graph, 2)).toEqual({
      revisions: [revision("a"), revision("b")],
      devices: [
        { publicKey: "", alias: "@", revisionEventId: "a", lastSeen: 1 },
      ],
    });
  });

  it("advances by the page size and stops at the known total", () => {
    expect(nextRepositoryLogVisible(0, 90)).toBe(REPOSITORY_LOG_PAGE_SIZE);
    expect(nextRepositoryLogVisible(80, 90)).toBe(90);
    expect(nextRepositoryLogVisible(90, 90)).toBe(90);
  });
});
