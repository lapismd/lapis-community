import { describe, expect, it, vi } from "vitest";
import { buildRepositoryAgentContexts } from "../../projects/repository-agent-context.js";
import {
  contextFixture as f,
  repositoryContextEvents,
} from "../../testing/repository-context-fixture.js";
import { agentContextReferences } from "./references.js";
import {
  contextThreadRoot,
  createAgentContextNavigation,
} from "./navigation.js";
import type {
  CommunityMessageModel,
  CommunityRoomModel,
} from "../community-workspace/model.js";

const requestId = "e".repeat(64),
  rootId = "f".repeat(64);
const message: CommunityMessageModel = {
  id: requestId,
  authorId: f.user,
  content: "Please update the README",
  timestamp: "now",
  parentMessageId: rootId,
};
const room: CommunityRoomModel = {
  id: "local-room",
  groupId: "room",
  name: "Development",
  kind: "channel",
};
const owner = () => ({
  rooms: () => [room],
  messages: () => [message],
  selectRoom: vi.fn(),
  openPanel: vi.fn(),
  openTopic: vi.fn(),
  openDirectMessage: vi.fn(),
});

describe("agent context references", () => {
  it("deduplicates checkpoint references and navigates through the real channel ID", () => {
    const checkpoints = buildRepositoryAgentContexts(repositoryContextEvents());
    checkpoints[0]!.records[0]!.sourceEventId = requestId;
    const host = owner(),
      navigation = createAgentContextNavigation(host);
    const refs = agentContextReferences(
      [...checkpoints, ...checkpoints],
      undefined,
      navigation,
    );
    expect(refs.map((r) => r.kind)).toEqual([
      "commit",
      "change",
      "channel",
      "thread",
      "repository",
    ]);
    expect(refs[0]!.href).toContain(`/commits/${f.commit}`);
    expect(refs[1]!.href).toBe(refs[0]!.href);
    expect(refs[1]!.title).toContain("mmmmmmmm");
    expect(refs[3]!.title).toBe(`Open thread ${rootId}`);
    refs[2]!.select!();
    expect(host.selectRoom).toHaveBeenCalledWith("local-room");
    refs[3]!.select!();
    expect(host.openPanel).toHaveBeenCalledWith("local-room", {
      kind: "thread",
      roomId: "local-room",
      rootMessageId: rootId,
    });
  });

  it("omits absent code targets and marks unknown channels unavailable", () => {
    const [checkpoint] = buildRepositoryAgentContexts(
      repositoryContextEvents(),
    );
    checkpoint!.records[0]!.sourceEventId = requestId;
    const refs = agentContextReferences([
      { ...checkpoint!, commitIds: [], targets: [] },
    ]);
    expect(refs.map((r) => r.kind)).toEqual([
      "channel",
      "thread",
      "repository",
    ]);
    expect(refs[0]!.disabled).toBe(true);
    expect(refs[1]!.title).toBe(`Open request ${requestId}`);
    expect(refs[1]!.disabled).toBe(true);
  });

  it("uses the newest checkpoint version when linking a rewritten change", () => {
    const [checkpoint] = buildRepositoryAgentContexts(
      repositoryContextEvents(),
    );
    const newer = {
      ...checkpoint!,
      createdAt: checkpoint!.createdAt + 1,
      commitIds: ["c".repeat(40)],
      targets: [{ commitId: "c".repeat(40), changeId: "d".repeat(32) }],
    };
    const refs = agentContextReferences([checkpoint!, newer]);
    expect(refs.filter((r) => r.kind === "change")).toHaveLength(1);
    expect(refs.find((r) => r.kind === "change")!.href).toContain(
      `/commits/${"c".repeat(40)}`,
    );
  });

  it("resolves known parents without requiring them in the current history window", () => {
    expect(contextThreadRoot([message], requestId)).toBe(rootId);
    expect(contextThreadRoot([], requestId)).toBeUndefined();
    expect(
      contextThreadRoot(
        [{ ...message, parentMessageId: requestId }],
        requestId,
      ),
    ).toBeUndefined();
  });

  it("opens forum topics at explicit roots", () => {
    const host = owner();
    host.rooms = () => [{ ...room, kind: "forum" }];
    createAgentContextNavigation(host).openThread("room", requestId, rootId);
    expect(host.selectRoom).toHaveBeenCalledWith("local-room");
    expect(host.openTopic).toHaveBeenCalledWith(rootId);
    expect(host.openPanel).not.toHaveBeenCalled();
  });
});
