import { describe, expect, it } from "vitest";

import { repositorySurfaceLoadsRefs } from "./repository-surface-refs.js";

describe("repositorySurfaceLoadsRefs", () => {
  it("loads refs on Log as well as Files, Overview, and Commits", () => {
    expect(repositorySurfaceLoadsRefs("log")).toBe(true);
    expect(repositorySurfaceLoadsRefs("files")).toBe(true);
    expect(repositorySurfaceLoadsRefs("overview")).toBe(true);
    expect(repositorySurfaceLoadsRefs("commits")).toBe(true);
    expect(repositorySurfaceLoadsRefs("oplog")).toBe(false);
    expect(repositorySurfaceLoadsRefs("reviews")).toBe(false);
  });
});
