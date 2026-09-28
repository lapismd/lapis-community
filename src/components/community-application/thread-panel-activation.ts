import { activateCommunityApplicationLocation } from "./application-location-activation.js";
import type { CommunityApplicationLocation } from "./navigation.js";

type ActivationContext = Parameters<
  typeof activateCommunityApplicationLocation
>[1];

export function createCommunityApplicationLocationActivation(frames?: {
  request(callback: FrameRequestCallback): number;
  cancel(frame: number): void;
}) {
  const requestFrame = frames
    ? (callback: FrameRequestCallback) => frames.request(callback)
    : typeof requestAnimationFrame === "function"
      ? (callback: FrameRequestCallback) => requestAnimationFrame(callback)
      : undefined;
  const cancelFrame = frames
    ? (pendingFrame: number) => frames.cancel(pendingFrame)
    : typeof cancelAnimationFrame === "function"
      ? (pendingFrame: number) => cancelAnimationFrame(pendingFrame)
      : undefined;
  let frame: number | undefined;

  function cancel(): void {
    if (frame !== undefined) cancelFrame?.(frame);
    frame = undefined;
  }

  function activate(
    location: CommunityApplicationLocation,
    context: ActivationContext,
  ): void {
    cancel();
    if (location.panel.kind !== "thread" || requestFrame === undefined) {
      activateCommunityApplicationLocation(location, context);
      return;
    }
    frame = requestFrame(() => {
      frame = requestFrame(() => {
        frame = undefined;
        activateCommunityApplicationLocation(location, context);
      });
    });
  }

  return { activate, cancel };
}
