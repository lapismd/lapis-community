import { describe, expect, it } from "vitest";

import {
  KIND_JJ_AGENT_CONTEXT_PAGE,
  KIND_JJ_CHECKPOINT_MANIFEST,
  KIND_JJ_GRAPH_MANIFEST,
  KIND_JJ_OPERATION,
  KIND_JJ_OPERATION_GRAPH,
  KIND_JJ_REVISION,
  KIND_JJ_VIEW,
} from "../projects/work-item-filters.js";
import { createLocalProjectForgeFixture } from "./projects.js";

describe("local project forge fixture", () => {
  it("creates a hosted repository and a distinct project task anchor", () => {
    const ownerPubkey = "a".repeat(64);
    const contributorPubkey = "b".repeat(64);
    const fixture = createLocalProjectForgeFixture({
      ownerPubkey,
      contributorPubkey,
      channelId: "project-development",
      relatedChannelId: "general",
      relayUrl: "ws://registry.localhost:8281/",
      createdAt: 1_700_000_000,
    });

    expect(fixture.publications).toHaveLength(14);
    expect(fixture.projectCoordinate).toBe(
      `30621:${ownerPubkey}:lapis-community`,
    );
    expect(fixture.repositoryCoordinate).toBe(
      `30617:${ownerPubkey}:lapis-community`,
    );
    expect(fixture.taskAnchorCoordinate).toBe(
      `30617:${ownerPubkey}:lapis-community-project-tasks`,
    );

    const [repository, taskAnchor, project, repositoryTask, projectTask] =
      fixture.publications.map(({ template }) => template);
    expect(project?.tags.filter((tag) => tag[0] === "a")).toEqual([
      ["a", fixture.repositoryCoordinate, "ws://registry.localhost:8281/"],
      ["a", fixture.taskAnchorCoordinate, "ws://registry.localhost:8281/"],
    ]);
    expect(project?.tags).toContainEqual(["buzz-related-channel", "general"]);
    expect(repository?.tags.some((tag) => tag[0] === "clone")).toBe(false);
    expect(repository?.tags).not.toContainEqual([
      "project-task-anchor",
      "true",
    ]);
    expect(taskAnchor?.tags).toContainEqual(["project-task-anchor", "true"]);
    expect(taskAnchor?.tags.some((tag) => tag[0] === "clone")).toBe(false);
    expect(repositoryTask?.tags).toContainEqual([
      "a",
      fixture.repositoryCoordinate,
    ]);
    expect(projectTask?.tags).toContainEqual([
      "a",
      fixture.taskAnchorCoordinate,
    ]);
    expect(fixture.publications.slice(5).map(({ signer }) => signer)).toEqual(
      Array(9).fill("agent"),
    );
    expect(
      fixture.publications.slice(5).map(({ template }) => template.kind),
    ).toEqual([
      KIND_JJ_OPERATION,
      KIND_JJ_REVISION,
      KIND_JJ_REVISION,
      KIND_JJ_VIEW,
      KIND_JJ_OPERATION_GRAPH,
      KIND_JJ_GRAPH_MANIFEST,
      KIND_JJ_AGENT_CONTEXT_PAGE,
      KIND_JJ_AGENT_CONTEXT_PAGE,
      KIND_JJ_AGENT_CONTEXT_PAGE,
    ]);
    expect(
      fixture.publications[fixture.agentContext.pagePublicationIndex]?.template
        .kind,
    ).toBe(KIND_JJ_AGENT_CONTEXT_PAGE);
    const manifest = fixture.agentContext.checkpointManifest("f".repeat(64));
    expect(manifest.signer).toBe("agent");
    expect(manifest.template.kind).toBe(KIND_JJ_CHECKPOINT_MANIFEST);
    expect(JSON.parse(manifest.template.content)).toMatchObject({
      page_event_ids: ["f".repeat(64)],
      record_count: 3,
    });
  });
});
