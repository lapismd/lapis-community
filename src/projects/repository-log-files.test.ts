import { describe, expect, it } from "vitest";

import {
  repositoryLogChangedFiles,
  repositoryLogFilePatch,
} from "./repository-log-files.js";

describe("repository log changed files", () => {
  it("maps dest-Git stats onto a file listing", () => {
    expect(
      repositoryLogChangedFiles({
        commit: { sha: "a".repeat(40), subject: "merge" },
        stats: [
          { path: "src/app.ts", additions: 4, deletions: 1 },
          { path: "README.md", additions: 2, deletions: 0 },
        ],
      }).map((file) => file.path),
    ).toEqual(["src/app.ts", "README.md"]);
  });

  it("falls back to a split patch when stats are omitted", () => {
    expect(
      repositoryLogChangedFiles({
        commit: { sha: "a".repeat(40), subject: "merge" },
        patch: [
          "diff --git a/notes.md b/notes.md",
          "--- a/notes.md",
          "+++ b/notes.md",
          "+hello",
        ].join("\n"),
      }),
    ).toEqual([{ path: "notes.md", additions: 1, deletions: 0 }]);
  });

  it("returns the dest-Git patch for one selected path", () => {
    const patch = [
      "diff --git a/notes.md b/notes.md",
      "--- a/notes.md",
      "+++ b/notes.md",
      "+hello",
      "diff --git a/skip.ts b/skip.ts",
      "--- a/skip.ts",
      "+++ b/skip.ts",
      "+skip",
    ].join("\n");
    expect(
      repositoryLogFilePatch(
        { commit: { sha: "a".repeat(40), subject: "merge" }, patch },
        "notes.md",
      ),
    ).toContain("+hello");
    expect(
      repositoryLogFilePatch(
        { commit: { sha: "a".repeat(40), subject: "merge" }, patch },
        "missing.md",
      ),
    ).toBeUndefined();
  });
});
