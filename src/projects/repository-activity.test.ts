import { describe, expect, it } from "vitest";

import type { NostrEvent } from "../protocol/index.js";
import { PROJECT_FORGE_KINDS } from "./model.js";
import { materializeProjectForgeCatalog } from "./reducer.js";
import {
  KIND_JJ_OPERATION,
  buildRepositoryActivity,
  projectVisibleActivity,
  repositoryCommitActivity,
  repositoryVisibleActivity,
} from "./repository-activity.js";
import {
  PROJECT_REPOSITORY_TABS,
  PROJECT_WORKSPACE_TABS,
  isProjectForgeSurface,
} from "./surfaces.js";

const owner = "1".repeat(64);
const repositoryCoordinate = `${PROJECT_FORGE_KINDS.repository}:${owner}:notes`;
const otherRepositoryCoordinate = `${PROJECT_FORGE_KINDS.repository}:${owner}:other`;

function event(
  id: string,
  kind: number,
  createdAt: number,
  tags: string[][],
  content = "",
): NostrEvent {
  return {
    id: id.repeat(64).slice(0, 64),
    kind,
    pubkey: owner,
    created_at: createdAt,
    tags,
    content,
    sig: "f".repeat(128),
  };
}

function catalog() {
  return materializeProjectForgeCatalog([
    event("1", PROJECT_FORGE_KINDS.project, 10, [
      ["d", "notes"],
      ["name", "Notes"],
      ["a", repositoryCoordinate],
      ["a", otherRepositoryCoordinate],
    ]),
    event("2", PROJECT_FORGE_KINDS.repository, 11, [
      ["d", "notes"],
      ["name", "notes-desktop"],
    ]),
    event("3", PROJECT_FORGE_KINDS.repository, 12, [
      ["d", "other"],
      ["name", "notes-other"],
    ]),
  ]);
}

function repositoryByIdentifier(
  projectCatalog: ReturnType<typeof catalog>,
  identifier: string,
) {
  return projectCatalog.repositories.find(
    (repository) => repository.address.identifier === identifier,
  )!;
}

function jjSyncEvent(
  id: string,
  createdAt: number,
  coordinate = repositoryCoordinate,
  extras: Record<string, unknown> = {},
): NostrEvent {
  return event(
    id,
    KIND_JJ_OPERATION,
    createdAt,
    [
      ["a", coordinate],
      ["r", "scope-notes"],
    ],
    JSON.stringify({
      schema: "jj-sync/operation",
      version: 2,
      scope_id: "scope-notes",
      replica_id: "replica-desktop",
      operation_id: `${id}cdef`.repeat(16).slice(0, 128),
      occurred_at_ms: createdAt * 1_000,
      ...extras,
    }),
  );
}

describe("repository activity", () => {
  it("lists Overview first and Log before Commits among repository tabs", () => {
    expect(PROJECT_REPOSITORY_TABS.map((tab) => tab.value)).toEqual([
      "overview",
      "activity",
      "log",
      "files",
      "commits",
      "tasks",
      "reviews",
    ]);
    expect(PROJECT_WORKSPACE_TABS.map((tab) => tab.value)).toEqual([
      "activity",
      "repositories",
      "commits",
      "tasks",
      "reviews",
      "channels",
      "contributors",
    ]);
    expect(isProjectForgeSurface("activity")).toBe(true);
    expect(isProjectForgeSurface("repositories")).toBe(true);
  });

  it("projects kind 3901 jj-sync operations beside dest-Git commits", () => {
    const projectCatalog = catalog();
    const activity = buildRepositoryActivity(
      projectCatalog,
      {
        tasks: [],
        pullRequests: [],
        events: [jjSyncEvent("4", 40)],
      },
      [
        {
          projectCoordinate: projectCatalog.projects[0]!.address.coordinate,
          repositoryCoordinate,
          commit: {
            sha: "a".repeat(40),
            subject: "Stay on dest main",
            commit_date: "1970-01-01T00:00:30.000Z",
          },
        },
      ],
    );

    expect(activity.map((item) => item.id)).toEqual([
      "jj-sync:" + "4".repeat(64),
      `commit:${repositoryCoordinate}:${"a".repeat(40)}`,
      `repository:${repositoryByIdentifier(projectCatalog, "other").event.id}`,
      `repository:${repositoryByIdentifier(projectCatalog, "notes").event.id}`,
      `project:${projectCatalog.projects[0]!.event.id}`,
    ]);
    expect(activity[0]).toMatchObject({
      kind: "commit",
      action: "published a jj-sync operation in",
      detail: "jj-sync",
      title: "4cdef".repeat(16),
      body: "replica-desktop",
      repositoryCoordinate,
    });
    expect(activity[1]).toMatchObject({
      kind: "commit",
      action: "pushed a commit to",
      detail: "a".repeat(40),
      title: "Stay on dest main",
    });
  });

  it("ignores malformed jj-sync announcements", () => {
    const projectCatalog = catalog();
    expect(
      buildRepositoryActivity(projectCatalog, {
        tasks: [],
        pullRequests: [],
        events: [
          event("4", KIND_JJ_OPERATION, 40, [["a", repositoryCoordinate]], "{"),
          event(
            "5",
            KIND_JJ_OPERATION,
            41,
            [["a", repositoryCoordinate]],
            JSON.stringify({ schema: "jj-sync/heads", operation_id: "nope" }),
          ),
        ],
      }).some((item) => item.detail === "jj-sync"),
    ).toBe(false);
  });

  it("keeps selected-repository rows and hides task anchors", () => {
    const projectCatalog = catalog();
    const notes = repositoryByIdentifier(projectCatalog, "notes");
    const other = {
      ...repositoryByIdentifier(projectCatalog, "other"),
      repositoryClass: "task-anchor" as const,
    };
    const activity = buildRepositoryActivity(projectCatalog, {
      tasks: [],
      pullRequests: [],
      events: [
        jjSyncEvent("4", 40),
        jjSyncEvent("5", 41, otherRepositoryCoordinate),
      ],
    });

    expect(
      repositoryVisibleActivity(activity, [notes, other], notes).map(
        (item) => item.id,
      ),
    ).toEqual(["jj-sync:" + "4".repeat(64), `repository:${notes.event.id}`]);
  });

  it("maps selected-repository dest commits into activity input", () => {
    const projectCatalog = catalog();
    const notes = repositoryByIdentifier(projectCatalog, "notes");
    expect(
      repositoryCommitActivity(
        notes,
        projectCatalog.projects[0]!.address.coordinate,
        [{ sha: "b".repeat(40), subject: "Carrier tip" }],
        [],
      ),
    ).toEqual([
      {
        projectCoordinate: projectCatalog.projects[0]!.address.coordinate,
        repositoryCoordinate,
        commit: { sha: "b".repeat(40), subject: "Carrier tip" },
      },
    ]);
    expect(repositoryCommitActivity(undefined, undefined, [], [])).toEqual([]);
  });

  it("keeps one project's forge feed and its own project row", () => {
    const projectCatalog = catalog();
    const notes = repositoryByIdentifier(projectCatalog, "notes");
    const other = repositoryByIdentifier(projectCatalog, "other");
    const activity = buildRepositoryActivity(projectCatalog, {
      tasks: [],
      pullRequests: [],
      events: [
        jjSyncEvent("4", 40),
        jjSyncEvent("5", 41, otherRepositoryCoordinate),
      ],
    });
    const visible = projectVisibleActivity(
      [
        ...activity,
        {
          id: "foreign",
          kind: "repository",
          createdAt: 50,
          actorPubkey: owner,
          action: "created a repository in",
          title: "elsewhere",
          body: "",
          projectCoordinate: "30621:other:other",
          repositoryCoordinate: otherRepositoryCoordinate,
        },
      ],
      projectCatalog.projects[0]!,
      [notes, { ...other, repositoryClass: "task-anchor" }],
    );

    expect(visible.map((item) => item.id)).toEqual([
      "jj-sync:" + "4".repeat(64),
      `repository:${notes.event.id}`,
      `project:${projectCatalog.projects[0]!.event.id}`,
    ]);
  });
});
