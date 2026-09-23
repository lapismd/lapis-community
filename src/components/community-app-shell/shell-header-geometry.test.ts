import { afterEach, expect, it, vi } from "vitest";
import { observeShellHeaderGeometry } from "./shell-header-geometry.js";

afterEach(() => vi.unstubAllGlobals());

it("coalesces observer deliveries into a frame and cancels pending layout work on teardown", () => {
  let resize: () => void = () => {};
  const disconnect = vi.fn();
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  let bounds = { left: 140, width: 900 };
  const surface = {
    getBoundingClientRect: () => ({ left: 20 }),
  } as HTMLElement;
  const measure = vi.fn(() => bounds);
  const main = { getBoundingClientRect: measure } as unknown as HTMLElement;
  const publish = vi.fn();
  const stop = observeShellHeaderGeometry(surface, main, publish);
  expect(publish).toHaveBeenCalledExactlyOnceWith(120, 900);
  bounds = { left: 220, width: 820 };
  resize();
  resize();
  expect(measure).toHaveBeenCalledTimes(1);
  expect(frames.size).toBe(1);
  for (const [id, callback] of frames) {
    frames.delete(id);
    callback(0);
  }
  expect(publish).toHaveBeenLastCalledWith(200, 820);
  resize();
  stop();
  expect(frames.size).toBe(0);
  expect(disconnect).toHaveBeenCalledOnce();
});
