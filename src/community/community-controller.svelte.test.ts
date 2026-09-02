import { finalizeEvent } from "nostr-tools/pure";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createCommunityTestRuntime,
  type CommunityTestRuntime,
} from "../testing/index.js";

let runtime: CommunityTestRuntime | undefined;

afterEach(() => runtime?.dispose());

async function connected(current: CommunityTestRuntime): Promise<void> {
  current.controller.initialize();
  await vi.waitFor(() => {
    expect(current.controller.state.status).toBe("connected");
  });
}

describe("createCommunityController", () => {
  it("projects channels, forums, inbox, members, and administrator capabilities", async () => {
    runtime = await createCommunityTestRuntime();
    await connected(runtime);
    const { controller } = runtime;
    expect(controller.state.workspace.activeRoomId).toBe("general");
    expect(
      controller.state.workspace.messages.map((message) => message.content),
    ).toEqual(["Welcome to Lapis Community", "Hello from a member"]);
    expect(controller.state.inbox?.items).toHaveLength(1);
    expect(controller.state.capabilities.manageMembers).toBe(true);

    controller.actions.selectRoom("support");
    expect(controller.state.workspace.view).toBe("forum-index");
    expect(controller.state.workspace.topics[0]?.title).toBe("Portable forums");
    controller.actions.openTopic(controller.state.workspace.topics[0]!.id);
    expect(controller.state.workspace.view).toBe("forum-thread");
  });

  it("publishes controller actions and reconciles live relay events", async () => {
    runtime = await createCommunityTestRuntime();
    await connected(runtime);
    const { controller, relay, scenario } = runtime;

    await controller.actions.sendMessage("general", "Controller message");
    expect(controller.state.workspace.messages.at(-1)?.content).toBe(
      "Controller message",
    );
    const published = controller.state.workspace.messages.at(-1)!;
    await controller.actions.toggleReaction(published.id, "👍");
    expect(
      controller.state.workspace.messages.find(
        (message) => message.id === published.id,
      )?.reactions?.[0],
    ).toMatchObject({ emoji: "👍", count: 1 });

    const live = finalizeEvent(
      {
        kind: 9,
        created_at: 1_700_000_200,
        content: "Live member event",
        tags: [["h", "general"]],
      },
      new Uint8Array(32).fill(44),
    );
    await relay.publish(live);
    await vi.waitFor(() => {
      expect(
        controller.state.workspace.messages.some(
          (message) => message.content === "Live member event",
        ),
      ).toBe(true);
    });

    await controller.actions.search("member");
    expect(controller.state.searchResults.length).toBeGreaterThan(0);
    expect(scenario.scope.id).toBe(
      controller.state.workspace.activeCommunityId,
    );
  });

  it("retains retryable operation failures without changing protocol capabilities", async () => {
    runtime = await createCommunityTestRuntime();
    await connected(runtime);
    runtime.relay.setFaults({ rejectPublish: "policy rejected the message" });
    await expect(
      runtime.controller.actions.sendMessage("general", "Rejected"),
    ).rejects.toThrow("policy rejected the message");
    expect(runtime.controller.state.operations["send:general"]).toEqual({
      status: "failed",
      message: "policy rejected the message",
    });
    expect(runtime.controller.state.capabilities.archive).toBe(false);
  });
});
