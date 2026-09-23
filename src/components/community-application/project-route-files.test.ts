import { describe, expect, it } from "vitest";

import {
  repositoryFilesHash,
  repositoryFilesRouteFromHash,
  repositoryViewRevision,
  storedRepositoryFilesFields,
} from "./project-route-files.js";
import { projectRouteFromHash, projectRouteToHash } from "./project-route.js";

describe("repository files routes", () => {
  const coordinate = "30617:owner:probe";
  const revision = "review/npub1example/ab".concat("cd".repeat(14));

  it("round-trips a branch or commit in front of files", () => {
    const route = {
      kind: "repository" as const,
      coordinate,
      surface: "files" as const,
      revision: "main",
      path: "src/app.ts",
    };
    expect(projectRouteFromHash(projectRouteToHash(route))).toEqual(route);
    expect(repositoryFilesHash(coordinate, "a".repeat(40))).toBe(
      `#/projects/repository/${coordinate}/${"a".repeat(40)}/files`,
    );
    expect(projectRouteFromHash(repositoryFilesHash(coordinate, revision))).toEqual({
      kind: "repository",
      coordinate,
      surface: "files",
      revision,
    });
  });

  it("keeps a bare files URL and rejects a revision after files", () => {
    expect(
      projectRouteFromHash(`#/projects/repository/${coordinate}/files`),
    ).toEqual({ kind: "repository", coordinate, surface: "files" });
    expect(
      repositoryFilesRouteFromHash(
        `#/projects/repository/${coordinate}/files/${"a".repeat(40)}`,
      ),
    ).toBeNull();
    expect(storedRepositoryFilesFields({
      surface: "files",
      revision: "community-visible",
      path: "README.md",
    })).toEqual({ revision: "community-visible", path: "README.md" });
  });

  it("uses the URL revision for files and otherwise the selected branch", () => {
    const branches = [
      { name: "community-visible", sha: "c".repeat(40) },
      { name: "main", sha: "d".repeat(40) },
    ];
    expect(
      repositoryViewRevision({
        surface: "files",
        routeRevision: "main",
        requestedBranch: "community-visible",
        requestedOwnerMatches: true,
        branches,
      }),
    ).toEqual({ branch: "main", revision: "main" });
    expect(
      repositoryViewRevision({
        surface: "files",
        routeRevision: "b".repeat(40),
        requestedBranch: "main",
        requestedOwnerMatches: true,
        branches,
        headName: "main",
      }).revision,
    ).toBe("b".repeat(40));
    expect(
      repositoryViewRevision({
        surface: "overview",
        routeRevision: "main",
        requestedBranch: "community-visible",
        requestedOwnerMatches: true,
        branches,
      }).branch,
    ).toBe("community-visible");
  });
});
