import { afterEach, describe, expect, it } from "vitest";

import { COMMUNITY_MESSAGE_EDIT_KIND } from "../../community/message-moderation.js";
import { lapisPluginSupportGroupId } from "../../protocol/index.js";
import {
  createRegistryCommunityStoryRuntime,
  type RegistryCommunityStoryRuntime,
} from "../../testing/registry-community-test-runtime.js";

import { createRegistryCommunityController } from "./registry-community-controller.svelte.js";

let runtime: RegistryCommunityStoryRuntime | undefined;

afterEach(() => {
  runtime?.dispose();
  runtime = undefined;
});

describe("createRegistryCommunityController authored reviews", () => {
  it("publishes an undirected review as a top-level reply to the active discussion root", async () => {
    runtime = await createRegistryCommunityStoryRuntime({ backend: "memory" });
    const { dataSource, scenario } = runtime;
    const controller = createRegistryCommunityController({
      plugin: scenario.plugin,
      name: scenario.name,
      version: scenario.version,
      publisher: scenario.publisher,
      relays: JSON.stringify([scenario.relayUrl]),
      dataSource,
      identity: scenario.identity,
    });

    await controller.initializeSummary();
    await controller.refresh(0);
    const active = controller.allReviews.find(
      (review) => review.event.id === controller.activePostId,
    );
    expect(active).toBeDefined();
    if (active === undefined) return;
    const relay = runtime.relayFactory.create(scenario.relayUrl);
    const supportGroupId = lapisPluginSupportGroupId(scenario.plugin);
    const rootsBefore = await relay.query({
      kinds: [11],
      "#h": [supportGroupId],
    });

    await expect(
      controller.submitComment("An undirected Registry review"),
    ).resolves.toBe(true);

    const replies = await relay.query({
      kinds: [1_111],
      "#E": [active.rootEventId],
    });
    const published = replies.find(
      (event) => event.content === "An undirected Registry review",
    );
    expect(published).toBeDefined();
    expect(published?.tags).toContainEqual([
      "E",
      active.rootEventId,
      scenario.relayUrl,
      expect.any(String),
    ]);
    expect(published?.tags).toContainEqual([
      "e",
      active.rootEventId,
      scenario.relayUrl,
      expect.any(String),
    ]);
    expect(
      await relay.query({ kinds: [11], "#h": [supportGroupId] }),
    ).toHaveLength(rootsBefore.length);

    relay.close();
    controller.dispose();
  });

  it("publishes edits and deletions while retaining the original review identity", async () => {
    runtime = await createRegistryCommunityStoryRuntime({ backend: "memory" });
    const { dataSource, scenario } = runtime;
    const controller = createRegistryCommunityController({
      plugin: scenario.plugin,
      name: scenario.name,
      version: scenario.version,
      publisher: scenario.publisher,
      relays: JSON.stringify([scenario.relayUrl]),
      dataSource,
      identity: scenario.identity,
    });

    await controller.initializeSummary();
    await controller.refresh(0);
    const authoredReview = controller.allReviews.find(
      (review) => review.event.pubkey === scenario.publisher,
    );
    expect(authoredReview).toBeDefined();
    if (authoredReview === undefined) return;

    controller.startEdit(authoredReview);
    expect(controller.editingReview?.event.id).toBe(authoredReview.event.id);
    expect(controller.comment).toBe(authoredReview.content);

    await expect(
      controller.submitComment("Updated Registry review"),
    ).resolves.toBe(true);
    expect(
      controller.allReviews.find(
        (review) => review.event.id === authoredReview.event.id,
      ),
    ).toMatchObject({
      content: "Updated Registry review",
      edited: true,
      event: { id: authoredReview.event.id },
    });
    const relay = runtime.relayFactory.create(scenario.relayUrl);
    const edits = await relay.query({
      kinds: [COMMUNITY_MESSAGE_EDIT_KIND],
      "#e": [authoredReview.event.id],
    });
    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({
      pubkey: scenario.publisher,
      content: "Updated Registry review",
    });

    await controller.deleteReview(authoredReview);
    expect(
      controller.allReviews.some(
        (review) => review.event.id === authoredReview.event.id,
      ),
    ).toBe(false);
    const deletions = await relay.query({
      kinds: [5],
      "#e": [authoredReview.event.id],
    });
    expect(deletions).toHaveLength(1);
    expect(deletions[0]?.pubkey).toBe(scenario.publisher);

    const anotherAuthorsReview = controller.allReviews.find(
      (review) => review.event.pubkey !== scenario.publisher,
    );
    expect(anotherAuthorsReview).toBeDefined();
    if (anotherAuthorsReview !== undefined) {
      controller.startEdit(anotherAuthorsReview);
      expect(controller.editingReview).toBeUndefined();
      await expect(
        controller.deleteReview(anotherAuthorsReview),
      ).rejects.toThrow("Only the author can delete this message.");
    }

    relay.close();
    controller.dispose();
  });

  it("reports a Registry review privately to configured curators", async () => {
    runtime = await createRegistryCommunityStoryRuntime({ backend: "memory" });
    const { dataSource, scenario } = runtime;
    const relay = runtime.relayFactory.create(scenario.relayUrl);
    const curatorPubkey = await scenario.member.getPublicKey();
    await relay.publish(
      await scenario.member.signEvent({
        kind: 39_002,
        created_at: 1_700_200_000,
        content: "",
        tags: [
          ["d", "plugin-releases"],
          ["p", curatorPubkey, "registry-curator"],
        ],
      }),
    );
    await relay.publish(
      await scenario.member.signEvent({
        kind: 10_050,
        created_at: 1_700_200_001,
        content: "",
        tags: [["relay", scenario.relayUrl]],
      }),
    );
    const controller = createRegistryCommunityController({
      plugin: scenario.plugin,
      name: scenario.name,
      version: scenario.version,
      publisher: scenario.publisher,
      relays: JSON.stringify([scenario.relayUrl]),
      dataSource,
      identity: scenario.identity,
    });
    await controller.initializeSummary();
    await controller.refresh(0);
    const review = controller.allReviews.find(
      (candidate) => candidate.event.pubkey === scenario.publisher,
    );
    expect(review).toBeDefined();
    if (review === undefined) return;
    const activePostId = controller.activePostId;

    await controller.reportReview(review, {
      category: "spam",
      context: "Repeated release links.",
    });

    expect(controller.message).toBe(
      "Report sent privately to the community curators.",
    );
    expect(controller.activePostId).toBe(activePostId);
    const reopenedRelay = runtime.relayFactory.create(scenario.relayUrl);
    expect(await reopenedRelay.query({ kinds: [1_059] })).toHaveLength(2);

    reopenedRelay.close();
    controller.dispose();
  });
});
