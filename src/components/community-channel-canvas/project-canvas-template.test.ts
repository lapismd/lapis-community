import { describe, expect, it } from "vitest";

import type { CommunityRoomModel } from "../community-workspace/model.js";
import { createProjectStoryFixture } from "../community-projects/story-fixtures.js";
import { projectCanvasStarterForChannel } from "./project-canvas-template.js";

describe("projectCanvasStarterForChannel", () => {
  it("builds an app and agent-controller starter for the bound project channel", () => {
    const fixture = createProjectStoryFixture("plugin-development");
    const room = {
      id: "plugin-development",
      groupId: "plugin-development",
      name: "plugin-development",
      kind: "channel",
    } as CommunityRoomModel;

    const starter = projectCanvasStarterForChannel(fixture.catalog, room);

    expect(starter).toContain("# Project channel: Community Client");
    expect(starter).toContain("Initial repository: `community-client`");
    expect(starter).toContain("Project channel: `plugin-development`");
    expect(starter).toContain("Nostr agent controller");
    expect(starter).toContain("Open **Activity** from the project workspace");
    expect(starter).toContain("meaningful Jujutsu checkpoints");
  });

  it("returns no starter for an unrelated channel", () => {
    const fixture = createProjectStoryFixture("plugin-development");
    const room = {
      id: "general",
      groupId: "general",
      name: "general",
      kind: "channel",
    } as CommunityRoomModel;

    expect(
      projectCanvasStarterForChannel(fixture.catalog, room),
    ).toBeUndefined();
  });
});
