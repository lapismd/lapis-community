import { describe, it, expect } from "vitest";
import { composerActivity } from "./model.js";
import {
  activityMatches,
  observerScope,
} from "../../community/agent-activity-context.js";
import {
  storyAgentState,
  storyAgent,
} from "../community-agents/story-fixtures.js";
const now = 1_800_000_000_000;
const scope = {
  agentPubkey: storyAgent.pubkey,
  scopeKey: "relay/general/agent/thread/a",
  channelId: "general",
  threadRootId: "a",
  conversationKind: "thread" as const,
  active: true,
  state: "running",
  updatedAt: now,
  preview: "Reading files",
};
describe("composer activity", () => {
  it("keeps DMs with the selected recipient", () => {
    const { channelId, threadRootId, ...base } = scope;
    const dm = {
      ...base,
      conversationKind: "dm" as const,
    };
    const model = storyAgentState({
      conversationScopes: { a: dm, b: { ...dm, agentPubkey: "other" } },
    });
    expect(
      composerActivity(model, { kind: "dm", agentPubkey: "other" }, now),
    ).toEqual([]);
    expect(
      composerActivity(
        model,
        { kind: "dm", agentPubkey: storyAgent.pubkey },
        now,
      ),
    ).toHaveLength(1);
  });
  it("isolates agent conversations and exact threads while channels aggregate", () => {
    const model = storyAgentState({
      conversationScopes: {
        a: scope,
        b: {
          ...scope,
          scopeKey: "other",
          threadRootId: "b",
          preview: "Running tests",
        },
        c: { ...scope, channelId: "private" },
      },
    });
    expect(
      composerActivity(
        model,
        { kind: "thread", channelId: "general", threadRootId: "a" },
        now,
      ).map((entry) => entry.preview),
    ).toEqual(["Reading files"]);
    expect(
      composerActivity(model, { kind: "channel", channelId: "general" }, now),
    ).toHaveLength(2);
    expect(composerActivity(model, { kind: "dm" }, now)).toHaveLength(0);
  });
  it("hides cancelled permission waits after expiry", () => {
    expect(
      composerActivity(
        storyAgentState({
          conversationScopes: {
            a: {
              ...scope,
              active: false,
              state: "cancelled",
              preview: "Waiting for your permission",
            },
          },
        }),
        { kind: "overview" },
        now,
      ),
    ).toEqual([]);
  });

  it("retains failures and ignores completed or stale active work", () => {
    for (const current of [
      { ...scope, active: false, state: "completed" },
      { ...scope, updatedAt: now - 180_001 },
    ])
      expect(
        composerActivity(
          storyAgentState({ conversationScopes: { a: current } }),
          { kind: "overview" },
          now,
        ),
      ).toEqual([]);
    expect(
      composerActivity(
        storyAgentState({
          conversationScopes: {
            a: {
              ...scope,
              active: false,
              state: "failed",
              updatedAt: now - 10_001,
            },
          },
        }),
        { kind: "overview" },
        now,
      ),
    ).toHaveLength(1);
  });
  it("prioritizes permission and keeps public working status generic", () => {
    const model = storyAgentState({
      conversationScopes: { a: { ...scope, state: "waiting_permission" } },
      publicWorking: [
        {
          agentPubkey: "other",
          channelId: "general",
          expiresAt: now / 1000 + 8,
        },
      ],
    });
    const entries = composerActivity(
      model,
      { kind: "channel", channelId: "general" },
      now,
    );
    expect(entries[0]?.preview).toBe("Waiting for your permission");
    expect(entries[1]).toMatchObject({ preview: "Working", canOpen: false });
  });
  it("uses legacy encrypted scope metadata without guessing unknown thread context", () => {
    const frame = {
      version: 2 as const,
      seq: 1,
      kind: "turn_started",
      timestamp: "",
      channelId: "general",
      payload: { scopeKey: scope.scopeKey },
    };
    expect(
      activityMatches(
        { kind: "thread", channelId: "general", threadRootId: "a" },
        observerScope(frame),
      ),
    ).toBe(true);
    expect(
      activityMatches(
        { kind: "thread", channelId: "general", threadRootId: "a" },
        observerScope({ ...frame, payload: {} }),
      ),
    ).toBe(false);
  });
});
