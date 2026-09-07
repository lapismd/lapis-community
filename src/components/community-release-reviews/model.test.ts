import { describe, expect, it } from "vitest";

import type {
  RegistryReleaseInspectionState,
  RegistryReleaseReviewEntry,
} from "../../registry/index.js";
import type { NostrEvent } from "../../protocol/index.js";
import { groupCommunityReleaseReviews } from "./model.js";

function entry(
  id: string,
  state: RegistryReleaseInspectionState,
): RegistryReleaseReviewEntry {
  const releaseEvent: NostrEvent = {
    id,
    pubkey: "publisher",
    created_at: 1,
    kind: 9,
    tags: [],
    content: id,
    sig: "signature",
  };
  return {
    releaseEvent,
    inspection: { eventId: id, state, diagnostics: [] },
    curatorDecisionEvents: [],
  };
}

describe("groupCommunityReleaseReviews", () => {
  it("keeps source order while separating pending, reviewed, and blocked posts", () => {
    const entries = [
      entry("pending", "pending"),
      entry("approved", "approved"),
      entry("rejected", "rejected"),
      entry("revoked", "revoked"),
      entry("withdrawn", "withdrawn"),
      entry("untrusted", "untrusted"),
      entry("invalid", "invalid"),
      entry("unavailable", "unavailable"),
    ];

    const groups = groupCommunityReleaseReviews(entries);

    expect(groups.pending.map((value) => value.releaseEvent.id)).toEqual([
      "pending",
    ]);
    expect(groups.reviewed.map((value) => value.releaseEvent.id)).toEqual([
      "approved",
      "rejected",
      "revoked",
      "withdrawn",
    ]);
    expect(groups.blocked.map((value) => value.releaseEvent.id)).toEqual([
      "untrusted",
      "invalid",
      "unavailable",
    ]);
  });
});
