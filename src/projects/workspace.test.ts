import { describe, expect, it } from "vitest";

import type { NostrEvent } from "../protocol/index.js";
import {
  PROJECT_FORGE_KINDS,
  type ProjectForgeCatalog,
  type ProjectForgeWorkItems,
} from "./model.js";
import { materializeProjectForgeCatalog } from "./reducer.js";
import {
  buildProjectForgeActivity,
  projectForgeChildChannels,
} from "./workspace.js";

const owner = "1".repeat(64);
const repositoryCoordinate = `${PROJECT_FORGE_KINDS.repository}:${owner}:notes`;

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

describe("project workspace projection", () => {
  it("projects unique related and repository channels while omitting the home channel", () => {
    const catalog = materializeProjectForgeCatalog([
      event("1", PROJECT_FORGE_KINDS.project, 10, [
        ["d", "notes"],
        ["buzz-channel", "home"],
        ["buzz-related-channel", "planning"],
        ["buzz-related-channel", "home"],
        ["buzz-related-channel", "planning"],
        ["a", repositoryCoordinate],
      ]),
      event("2", PROJECT_FORGE_KINDS.repository, 11, [
        ["d", "notes"],
        ["buzz-channel", "development"],
      ]),
    ]);

    expect(catalog.projects[0]?.relatedChannelIds).toEqual(["planning"]);
    expect(
      projectForgeChildChannels(catalog.projects[0]!, catalog.repositories),
    ).toEqual([
      { channelId: "planning", role: "related" },
      {
        channelId: "development",
        repositoryCoordinate,
        role: "related",
      },
    ]);
  });

  it("builds deterministic newest-first activity from catalog and work items", () => {
    const catalog = materializeProjectForgeCatalog([
      event("1", PROJECT_FORGE_KINDS.project, 10, [
        ["d", "notes"],
        ["name", "Notes"],
        ["a", repositoryCoordinate],
      ]),
      event("2", PROJECT_FORGE_KINDS.repository, 11, [
        ["d", "notes"],
        ["name", "notes-desktop"],
      ]),
    ]);
    const workItems: ProjectForgeWorkItems = {
      tasks: [
        {
          root: event("3", PROJECT_FORGE_KINDS.task, 12, [
            ["a", repositoryCoordinate],
            ["subject", "Prepare beta"],
          ]),
          repository: catalog.repositories[0]!.address,
          title: "Prepare beta",
          content: "Coordinate the release",
          labels: [],
          lifecycle: "open",
          assignees: [],
          activity: [
            {
              event: event(
                "4",
                PROJECT_FORGE_KINDS.note,
                13,
                [["e", "3".repeat(64)]],
                "Ready to test",
              ),
              encoding: "buzz-kind-1",
              assignees: [],
            },
          ],
          createdAt: 12,
          updatedAt: 13,
        },
      ],
      pullRequests: [],
      events: [],
    };

    const activity = buildProjectForgeActivity(
      catalog as ProjectForgeCatalog,
      workItems,
    );
    expect(activity.map((item) => item.kind)).toEqual([
      "comment",
      "task",
      "repository",
      "project",
    ]);
    expect(activity[0]).toMatchObject({
      action: "commented on a task in",
      title: "Prepare beta",
      projectCoordinate: catalog.projects[0]!.address.coordinate,
    });
  });
});
