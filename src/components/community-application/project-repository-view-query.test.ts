import { describe, expect, it } from "vitest";

import {
  createProjectStoryDataSource,
  projectStoryRepositoryCoordinate,
} from "../community-projects/story-fixtures.js";

import { loadProjectRepositoryView } from "./project-repository-view-query.js";

function abortSignal(): AbortSignal {
  return new AbortController().signal;
}

describe("loadProjectRepositoryView", () => {
  it("does not surface a capability error when capabilities were not requested", async () => {
    const source = createProjectStoryDataSource("query-view", "walgit", false);
    const session = await source.open({ relayUrl: "wss://relay.example" });
    const catalog = await session.loadCatalog();
    const result = await loadProjectRepositoryView(
      {
        catalog,
        session,
        identityAvailable: false,
        repositoryCoordinate: projectStoryRepositoryCoordinate,
        surface: "files",
        overviewSurface: "activity",
        pullRequestId: "",
        requestedRepositoryBranch: "main",
        requestedRepositoryBranchOwner: projectStoryRepositoryCoordinate,
        inlineProjectFilesSheetOpen: false,
        filesRouteRevision: "main",
      },
      abortSignal(),
    );
    expect(result.sourceError).toBe("");
    expect(
      result.tree?.entries.map((entry) => entry.path ?? entry.name),
    ).toEqual(["README.md", "src/app.ts", "src/index.ts"]);
  });
});
