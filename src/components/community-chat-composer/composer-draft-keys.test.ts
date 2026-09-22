import { describe, expect, it } from "vitest";

import { communityComposerDraftKey } from "./composer-draft-keys.js";

describe("communityComposerDraftKey", () => {
  it("scopes the same target by viewer and community", () => {
    const ada = communityComposerDraftKey({
      viewer: "ada",
      communityId: "lapis",
      surface: "forum-topic",
      target: "support",
    });
    const mara = communityComposerDraftKey({
      viewer: "mara",
      communityId: "lapis",
      surface: "forum-topic",
      target: "support",
    });
    const otherCommunity = communityComposerDraftKey({
      viewer: "ada",
      communityId: "other",
      surface: "forum-topic",
      target: "support",
    });
    expect(ada).not.toBe(mara);
    expect(ada).not.toBe(otherCommunity);
    expect(ada).toBe(
      communityComposerDraftKey({
        viewer: "ada",
        communityId: "lapis",
        surface: "forum-topic",
        target: "support",
      }),
    );
  });

  it("keeps an empty viewer distinct from a signed-in viewer", () => {
    const anonymous = communityComposerDraftKey({
      communityId: "lapis",
      surface: "pulse",
      target: "composer",
    });
    const signedIn = communityComposerDraftKey({
      viewer: "ada",
      communityId: "lapis",
      surface: "pulse",
      target: "composer",
    });
    expect(anonymous).not.toBe(signedIn);
    expect(anonymous).toContain('""');
  });

  it("separates surfaces that share a target id", () => {
    const topic = communityComposerDraftKey({
      viewer: "ada",
      communityId: "lapis",
      surface: "forum-topic",
      target: "root-1",
    });
    const thread = communityComposerDraftKey({
      viewer: "ada",
      communityId: "lapis",
      surface: "thread",
      target: "root-1",
    });
    const review = communityComposerDraftKey({
      viewer: "ada",
      communityId: "lapis",
      surface: "pull-request",
      target: "root-1",
    });
    expect(new Set([topic, thread, review]).size).toBe(3);
  });

  it("does not embed relay URLs", () => {
    const key = communityComposerDraftKey({
      viewer: "ada",
      communityId: "lapis",
      surface: "task",
      target: "task-1",
    });
    expect(key).not.toMatch(/wss:\/\//);
    expect(key).not.toMatch(/relay/i);
  });
});
