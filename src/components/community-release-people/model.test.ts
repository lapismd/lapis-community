import { describe, expect, it } from "vitest";

import type { NostrEvent } from "../../protocol/index.js";
import type { RegistryReleaseReviewEntry } from "../../registry/index.js";
import { communityReleaseMemberActivity } from "./model.js";

function event(id: string, pubkey: string): NostrEvent {
  return {
    id,
    pubkey,
    created_at: 1,
    kind: 9,
    tags: [],
    content: id,
    sig: "signature",
  };
}

function entry(
  id: string,
  publisher: string,
  curators: readonly string[],
): RegistryReleaseReviewEntry {
  return {
    releaseEvent: event(id, publisher),
    inspection: { eventId: id, state: "approved", diagnostics: [] },
    curatorDecisionEvents: curators.map((curator, index) =>
      event(`${id}-decision-${index}`, curator),
    ),
  };
}

describe("communityReleaseMemberActivity", () => {
  it("attributes release posts and curator decisions to their signers", () => {
    const activity = communityReleaseMemberActivity([
      entry("release-a", "publisher", ["curator"]),
      entry("release-b", "publisher", ["curator", "second-curator"]),
      entry("release-c", "other-publisher", []),
    ]);

    expect(activity.get("publisher")).toEqual({
      releaseCount: 2,
      curatorDecisionCount: 0,
    });
    expect(activity.get("curator")).toEqual({
      releaseCount: 0,
      curatorDecisionCount: 2,
    });
    expect(activity.get("second-curator")).toEqual({
      releaseCount: 0,
      curatorDecisionCount: 1,
    });
    expect(activity.get("other-publisher")).toEqual({
      releaseCount: 1,
      curatorDecisionCount: 0,
    });
  });
});
