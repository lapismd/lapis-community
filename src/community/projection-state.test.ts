import { describe, expect, it } from "vitest";
import { createProjectionQueue, shareProjection } from "./projection-state.js";

describe("projection scheduling and model identity", () => {
  it("retains nested message content on status changes and keyed prepends", () => {
    const previous = {
      status: "connected",
      messages: [{ id: "b", content: "**Keep me**", reactions: [] }],
    };
    const unchanged = shareProjection(previous, structuredClone(previous));
    expect(unchanged).toBe(previous);
    const next = shareProjection(previous, {
      status: "refreshing",
      messages: [
        { id: "a", content: "Earlier", reactions: [] },
        structuredClone(previous.messages[0]!),
      ],
    });
    expect(next.messages[1]).toBe(previous.messages[0]);
    expect(next.status).toBe("refreshing");
  });

  it("coalesces simultaneous requests and rejects stale completion while allowing one trailing pass", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const accepted: number[] = [];
    const request = createProjectionQueue(async (isCurrent) => {
      const call = ++calls;
      if (call === 1) await gate;
      if (isCurrent()) accepted.push(call);
    });
    const first = request();
    expect(request()).toBe(first);
    await Promise.resolve();
    expect(calls).toBe(1);
    expect(request()).toBe(first);
    request();
    release();
    await first;
    expect(calls).toBe(2);
    expect(accepted).toEqual([2]);
    await request();
    expect(accepted).toEqual([2, 3]);
  });
});
