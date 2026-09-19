import { describe, expect, it } from "vitest";

import type { ProjectForgeProject, ProjectForgeRepository } from "./model.js";
import {
  groupItemsByProjectRepository,
  preferredProjectForRepository,
  projectMemberRepositories,
} from "./project-repository-groups.js";

const hosted = {
  address: { coordinate: "30617:owner:notes" },
  repositoryClass: "hosted",
} as ProjectForgeRepository;
const other = {
  address: { coordinate: "30617:owner:other" },
  repositoryClass: "external",
} as ProjectForgeRepository;
const anchor = {
  address: { coordinate: "30617:owner:tasks" },
  repositoryClass: "task-anchor",
} as ProjectForgeRepository;

describe("project repository groups", () => {
  it("prefers the parent project that opened a repository", () => {
    const first = {
      address: { coordinate: "30621:owner:first" },
      repositories: [{ coordinate: hosted.address.coordinate }],
    } as ProjectForgeProject;
    const second = {
      address: { coordinate: "30621:owner:second" },
      repositories: [{ coordinate: hosted.address.coordinate }],
    } as ProjectForgeProject;
    expect(
      preferredProjectForRepository(
        [first, second],
        hosted.address.coordinate,
        second.address.coordinate,
      ),
    ).toBe(second);
    expect(
      preferredProjectForRepository([first, second], hosted.address.coordinate),
    ).toBe(first);
  });

  it("omits task anchors and empty groups", () => {
    expect(
      projectMemberRepositories([hosted, other, anchor], [
        hosted.address,
        other.address,
        anchor.address,
      ]),
    ).toEqual([hosted, other]);
    expect(
      groupItemsByProjectRepository(
        [
          { id: "a", repository: hosted.address.coordinate },
          { id: "b", repository: hosted.address.coordinate },
        ],
        [hosted, other, anchor],
        (item) => item.repository,
      ),
    ).toEqual([{ repository: hosted, items: [
      { id: "a", repository: hosted.address.coordinate },
      { id: "b", repository: hosted.address.coordinate },
    ] }]);
  });
});
