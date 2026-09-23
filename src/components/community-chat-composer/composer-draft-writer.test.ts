import { afterEach, describe, expect, it, vi } from "vitest";
import { createComposerDraftWriter } from "./composer-draft-writer.js";

describe("composer draft write lifecycle", () => {
  afterEach(() => vi.useRealTimers());

  it("flushes the latest pending write on teardown without waiting for the debounce", () => {
    vi.useFakeTimers();
    const write = vi.fn();
    const writer = createComposerDraftWriter();
    writer.schedule(() => write("old"));
    writer.schedule(() => write("latest"));
    expect(write).not.toHaveBeenCalled();
    writer.flush();
    expect(write).toHaveBeenCalledExactlyOnceWith("latest");
    vi.runAllTimers();
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("debounces edits and cancels a submitted draft", () => {
    vi.useFakeTimers();
    const write = vi.fn();
    const writer = createComposerDraftWriter();
    writer.schedule(write);
    vi.advanceTimersByTime(249);
    expect(write).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(write).toHaveBeenCalledTimes(1);
    writer.schedule(write);
    writer.cancel();
    writer.flush();
    vi.runAllTimers();
    expect(write).toHaveBeenCalledTimes(1);
  });
});
