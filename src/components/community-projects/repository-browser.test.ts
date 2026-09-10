import { describe, expect, it } from "vitest";

import type { ProjectForgeTreeEntry } from "../../projects/index.js";
import {
  isMarkdownRepositoryPath,
  repositoryBreadcrumbSegments,
  repositoryBrowserEntries,
  repositoryParentPath,
} from "./repository-browser.js";

const files: ProjectForgeTreeEntry[] = [
  { name: "README.md", path: "README.md", type: "blob", size: 40 },
  {
    name: "install.md",
    path: "docs/guides/setup/install.md",
    type: "blob",
  },
  { name: "app.ts", path: "src/app.ts", type: "blob" },
  { name: "index.ts", path: "src/index.ts", type: "blob" },
  { name: "theme.css", path: "src/styles/theme.css", type: "blob" },
];

describe("repositoryBrowserEntries", () => {
  it("collapses directory chains that contain no files or branches", () => {
    expect(repositoryBrowserEntries(files)).toEqual([
      { type: "tree", name: "docs/guides/setup", path: "docs/guides/setup" },
      { type: "tree", name: "src", path: "src" },
      {
        type: "blob",
        name: "README.md",
        path: "README.md",
        size: 40,
      },
    ]);
  });

  it("stops collapsing when a directory contains files or branches", () => {
    expect(repositoryBrowserEntries(files, "src")).toEqual([
      { type: "tree", name: "styles", path: "src/styles" },
      { type: "blob", name: "app.ts", path: "src/app.ts" },
      { type: "blob", name: "index.ts", path: "src/index.ts" },
    ]);
  });
});

describe("repository path helpers", () => {
  it("builds cumulative breadcrumb paths", () => {
    expect(repositoryBreadcrumbSegments("docs/guides/setup")).toEqual([
      { name: "docs", path: "docs" },
      { name: "guides", path: "docs/guides" },
      { name: "setup", path: "docs/guides/setup" },
    ]);
  });

  it("finds parents and markdown files", () => {
    expect(repositoryParentPath("docs/guides/README.md")).toBe("docs/guides");
    expect(repositoryParentPath("README.md")).toBe("");
    expect(isMarkdownRepositoryPath("docs/README.MD")).toBe(true);
    expect(isMarkdownRepositoryPath("src/index.ts")).toBe(false);
  });
});
