import type { RegistryReleaseReviewEntry } from "../../registry/index.js";

export interface CommunityReleaseMemberActivity {
  releaseCount: number;
  curatorDecisionCount: number;
}

export function communityReleaseMemberActivity(
  entries: readonly RegistryReleaseReviewEntry[],
): ReadonlyMap<string, CommunityReleaseMemberActivity> {
  const activity = new Map<string, CommunityReleaseMemberActivity>();
  const valueFor = (pubkey: string): CommunityReleaseMemberActivity => {
    const current = activity.get(pubkey);
    if (current !== undefined) return current;
    const created = { releaseCount: 0, curatorDecisionCount: 0 };
    activity.set(pubkey, created);
    return created;
  };
  for (const entry of entries) {
    valueFor(entry.releaseEvent.pubkey).releaseCount += 1;
    for (const decision of entry.curatorDecisionEvents) {
      valueFor(decision.pubkey).curatorDecisionCount += 1;
    }
  }
  return activity;
}
