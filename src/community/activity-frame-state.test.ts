import { describe, expect, it } from "vitest";
import {
  activityPayloadState,
  activityScopeStorageKey,
} from "./activity-frame-state.js";

describe("activity frame state", () => {
  it("keeps a host-queued status queued when the payload omits state", () => {
    expect(activityPayloadState("request_status", false, "", "Queued")).toBe(
      "queued",
    );
    expect(activityPayloadState("request_status", false, "", "Reading")).toBe(
      "unknown",
    );
    expect(
      activityPayloadState("request_status", false, "interrupted", "Blocked"),
    ).toBe("interrupted");
  });

  it("stores each request in one scope separately", () => {
    const scope = "relay/room/agent/channel";
    expect(activityScopeStorageKey("agent", scope, "queued")).not.toBe(
      activityScopeStorageKey("agent", scope, "fence"),
    );
  });
});

describe("truthful lifecycle projection", () => {
  it.each(["failed", "cancelled", "interrupted", "uncertain", "completed"])(
    "preserves %s from a terminal snapshot",
    (state) => {
      expect(activityPayloadState("turn_finished", true, state, "")).toBe(
        state,
      );
    },
  );
  it("does not invent running work for unknown status or settled approval", () => {
    expect(
      activityPayloadState("request_status", false, "future-state", ""),
    ).toBe("unknown");
    expect(activityPayloadState("permission_resolved", false, "", "")).toBe(
      "unknown",
    );
  });
});
