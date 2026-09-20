import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createCommunityTestRuntime,
  type CommunityTestRuntime,
} from "../testing/index.js";

let runtime: CommunityTestRuntime | undefined;

afterEach(() => runtime?.dispose());

async function connected(): Promise<CommunityTestRuntime> {
  runtime = await createCommunityTestRuntime();
  runtime.controller.initialize();
  await vi.waitFor(() => {
    expect(runtime!.controller.state.status).toBe("connected");
  });
  return runtime;
}

describe("community controller mention tags", () => {
  it("publishes unique mention p tags on kind 9 without dropping the parent p", async () => {
    const current = await connected();
    const mention = await current.scenario.participant.getPublicKey();
    await current.controller.actions.sendMessage("general", "Root for reply");
    const root = current.controller.state.workspace.messages.at(-1)!;
    await current.controller.actions.sendReply(
      root.id,
      "Continue with the agent",
      [mention, mention.toUpperCase()],
    );
    const published = await current.relay.query({
      kinds: [9],
      "#e": [root.id],
    });
    const reply = published.find(
      (event) => event.content === "Continue with the agent",
    );
    expect(reply?.tags.filter((tag) => tag[0] === "p")).toEqual([
      ["p", root.sourceEvent?.pubkey ?? expect.any(String)],
      ["p", mention],
    ]);
  });

  it("publishes mention p tags on forum comments", async () => {
    const current = await connected();
    const mention = await current.scenario.participant.getPublicKey();
    current.controller.actions.selectRoom("support");
    await vi.waitFor(() =>
      expect(current.controller.state.workspace.view).toBe("forum-index"),
    );
    const topic = current.controller.state.workspace.topics[0]!;
    current.controller.actions.openTopic(topic.id);
    await vi.waitFor(() =>
      expect(current.controller.state.workspace.view).toBe("forum-thread"),
    );
    await current.controller.actions.sendMessage("support", "Forum mention", [
      mention,
    ]);
    const [published] = await current.relay.query({
      kinds: [1_111],
      "#E": [topic.id],
    });
    expect(published?.tags).toContainEqual(["p", mention]);
    expect(
      published?.tags.some((tag) => tag[0] === "p" && tag[1] !== mention),
    ).toBe(true);
  });
});
