import { expect, it, vi } from "vitest";
import { createAgentContextNavigation } from "./navigation.js";
import { conversationMessage } from "../community-agent-conversation/model.js";
import { request, response } from "../../testing/agent-conversation-fixture.js";

it("loads an absent follow-up before choosing its original thread", async () => {
  const openPanel = vi.fn();
  const loadMessage = vi.fn(async () => conversationMessage(response, []));
  await createAgentContextNavigation({
    rooms: () => [
      { id: "local-room", groupId: "room", kind: "channel", name: "demo" },
    ],
    messages: () => [],
    loadMessage,
    selectRoom: vi.fn(),
    openPanel,
    openTopic: vi.fn(),
    openDirectMessage: vi.fn(),
  }).openThread("room", response.id);
  expect(loadMessage).toHaveBeenCalledWith(response.id);
  expect(openPanel).toHaveBeenCalledWith("local-room", {
    kind: "thread",
    roomId: "local-room",
    rootMessageId: request.id,
  });
});
