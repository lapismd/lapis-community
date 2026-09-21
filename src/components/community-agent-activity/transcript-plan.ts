import type { CommunityAgentTranscriptEntry } from "../../community/agent-contracts.js";
import type { CommunityAgentTranscriptTimeline } from "./transcript-timeline.js";

export function planLocationKey(
  turn: string | undefined,
  entryId: string,
): string {
  return turn ? `plan:${turn}` : `plan:${entryId}`;
}

export function applyTranscriptPlan(
  timeline: CommunityAgentTranscriptTimeline[],
  locations: Map<string, { group: number; item?: number }>,
  entry: Extract<CommunityAgentTranscriptEntry, { type: "plan" }>,
  turn: string | undefined,
): boolean {
  const key = planLocationKey(turn, entry.id);
  const location = locations.get(key);
  if (location) {
    const current = timeline[location.group];
    if (current?.kind === "plan") current.item = { ...current.item, ...entry };
    return true;
  }
  if (entry.entries.length === 0) return true;
  timeline.push({ kind: "plan", item: entry });
  locations.set(key, { group: timeline.length - 1 });
  return true;
}

export function visibleTranscriptTimeline(
  timeline: CommunityAgentTranscriptTimeline[],
): CommunityAgentTranscriptTimeline[] {
  return timeline.filter(
    (current) => current.kind !== "plan" || current.item.entries.length > 0,
  );
}
