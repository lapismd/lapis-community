import { afterEach, describe, expect, it, vi } from "vitest";

import type { CommunityApplicationLocationActions } from "./application-location-activation.js";
import { createCommunityApplicationLocationActivation } from "./thread-panel-activation.js";

const rootMessageId = "a".repeat(64);

function actions(): CommunityApplicationLocationActions {
  return {
    selectRoom: vi.fn(),
    clearReplyTarget: vi.fn(),
    openTopic: vi.fn(),
    openThread: vi.fn(),
    openDetails: vi.fn(),
    closeSidePanel: vi.fn(),
  };
}

function frames() {
  let nextId = 0;
  const pending = new Map<number, FrameRequestCallback>();
  return {
    request(callback: FrameRequestCallback) {
      const id = ++nextId;
      pending.set(id, callback);
      return id;
    },
    cancel(id: number) {
      pending.delete(id);
    },
    flush() {
      const callbacks = [...pending.values()];
      pending.clear();
      for (const callback of callbacks) callback(0);
    },
  };
}

function threadLocation(root = rootMessageId) {
  return {
    destination: "general",
    panel: { kind: "thread" as const, roomId: "general", rootMessageId: root },
  };
}

describe("createCommunityApplicationLocationActivation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not rebind browser frame functions to an internal scheduler", () => {
    let nextId = 0;
    const pending = new Map<number, FrameRequestCallback>();
    vi.stubGlobal(
      "requestAnimationFrame",
      function (this: unknown, callback: FrameRequestCallback) {
        expect(this).toBeUndefined();
        const id = ++nextId;
        pending.set(id, callback);
        return id;
      },
    );
    vi.stubGlobal("cancelAnimationFrame", function (this: unknown, id: number) {
      expect(this).toBeUndefined();
      pending.delete(id);
    });
    const flush = () => {
      const callbacks = [...pending.values()];
      pending.clear();
      for (const callback of callbacks) callback(0);
    };
    const activation = createCommunityApplicationLocationActivation();
    const target = actions();

    activation.activate(threadLocation(), {
      roomId: "general",
      activeRoomId: "general",
      inboxRoomId: "inbox",
      rooms: [{ id: "general", name: "general", kind: "channel" }],
      actions: target,
    });
    flush();
    flush();

    expect(target.openThread).toHaveBeenCalledWith(rootMessageId);
  });

  it("leaves a paint between selecting a thread panel and projecting it", () => {
    const scheduled = frames();
    const activation = createCommunityApplicationLocationActivation(scheduled);
    const target = actions();
    activation.activate(threadLocation(), {
      roomId: "general",
      activeRoomId: "general",
      inboxRoomId: "inbox",
      rooms: [{ id: "general", name: "general", kind: "channel" }],
      actions: target,
    });

    expect(target.openThread).not.toHaveBeenCalled();
    scheduled.flush();
    expect(target.openThread).not.toHaveBeenCalled();
    scheduled.flush();
    expect(target.openThread).toHaveBeenCalledWith(rootMessageId);
  });

  it("cancels a stale thread before its projection starts", () => {
    const scheduled = frames();
    const activation = createCommunityApplicationLocationActivation(scheduled);
    const target = actions();
    const context = {
      roomId: "general",
      activeRoomId: "general",
      inboxRoomId: "inbox",
      rooms: [{ id: "general", name: "general", kind: "channel" as const }],
      actions: target,
    };
    activation.activate(threadLocation(), context);
    scheduled.flush();
    activation.activate(
      { destination: "general", panel: { kind: "none" } },
      context,
    );
    scheduled.flush();

    expect(target.openThread).not.toHaveBeenCalled();
    expect(target.closeSidePanel).toHaveBeenCalledOnce();
  });
});
