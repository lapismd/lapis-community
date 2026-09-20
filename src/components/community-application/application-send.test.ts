import { describe, expect, it, vi } from "vitest";

import { createCommunityApplicationSend } from "./application-send.js";
import type { CommunityApplicationPanel } from "./navigation.js";

const mention = "a".repeat(64);

function host() {
  return {
    sendReply: vi.fn(async () => {}),
    sendMessage: vi.fn(async () => {}),
    sendDirectMessage: vi.fn(async () => {}),
    clearReplyTarget: vi.fn(),
    replyTarget: vi.fn(() => undefined),
    activePanel: vi.fn(
      (): CommunityApplicationPanel => ({
        kind: "thread",
        roomId: "general",
        rootMessageId: "root",
      }),
    ),
    activeRoom: vi.fn(() => ({
      id: "general",
      kind: "channel" as const,
    })),
    workspace: vi.fn(() => ({ currentMemberId: "1".repeat(64) })),
    runParticipationAction: vi.fn(async (_room, _kind, action) => {
      await action();
    }),
    openPanel: vi.fn(),
    setLastAction: vi.fn(),
    error: vi.fn(),
  };
}

describe("createCommunityApplicationSend", () => {
  it("forwards thread mention pubkeys", async () => {
    const current = host();
    const send = createCommunityApplicationSend(current);
    await send.sendThreadReply("root", "hello", [mention]);
    expect(current.sendReply).toHaveBeenCalledWith("root", "hello", [mention]);
  });

  it("forwards channel mention pubkeys", async () => {
    const current = host();
    current.activePanel.mockReturnValue({ kind: "none" });
    const send = createCommunityApplicationSend(current);
    await send.sendWorkspaceMessage("general", "hello", [mention]);
    expect(current.sendMessage).toHaveBeenCalledWith("general", "hello", [
      mention,
    ]);
  });
});
