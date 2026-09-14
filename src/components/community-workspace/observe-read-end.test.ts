import { afterEach, expect, it, vi } from "vitest";
import { observeReadEnd } from "./observe-read-end.js";

afterEach(() => vi.unstubAllGlobals());

it("acknowledges each visible head once and waits for hidden or clipped content", () => {
  let deliver: (entries: { isIntersecting: boolean }[]) => void = () => {};
  let visibilityChanged = () => {};
  const disconnect = vi.fn();
  const removeEventListener = vi.fn();
  const document = {
    visibilityState: "hidden",
    addEventListener: (_name: string, listener: () => void) => {
      visibilityChanged = listener;
    },
    removeEventListener,
  };
  vi.stubGlobal("document", document);
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: typeof deliver) {
        deliver = callback;
      }
      observe = vi.fn();
      disconnect = disconnect;
    },
  );
  const node = { closest: vi.fn(() => null) } as unknown as HTMLElement;
  const onRead = vi.fn();
  const action = observeReadEnd(node, { key: "first", onRead });
  deliver([{ isIntersecting: true }]);
  expect(onRead).not.toHaveBeenCalled();
  document.visibilityState = "visible";
  visibilityChanged();
  deliver([{ isIntersecting: false }]);
  expect(onRead).not.toHaveBeenCalled();
  deliver([{ isIntersecting: true }]);
  deliver([{ isIntersecting: true }]);
  expect(onRead).toHaveBeenCalledTimes(1);
  // Reprojection and manual unread on the same boundary do not clear it again.
  action.update({ key: "first" });
  action.update({ key: "first", onRead });
  deliver([{ isIntersecting: true }]);
  expect(onRead).toHaveBeenCalledTimes(1);
  const oldDelivery = deliver;
  action.update({ key: "new-event", onRead });
  oldDelivery([{ isIntersecting: true }]);
  deliver([{ isIntersecting: false }]);
  expect(onRead).toHaveBeenCalledTimes(1);
  deliver([{ isIntersecting: true }]);
  expect(onRead).toHaveBeenCalledTimes(2);
  action.update({ key: "other-room", onRead });
  deliver([{ isIntersecting: false }]);
  action.update({ key: "new-event", onRead });
  deliver([{ isIntersecting: true }]);
  expect(onRead).toHaveBeenCalledTimes(3);
  action.destroy();
  expect(disconnect).toHaveBeenCalled();
  expect(removeEventListener).toHaveBeenCalledWith(
    "visibilitychange",
    visibilityChanged,
  );
});
