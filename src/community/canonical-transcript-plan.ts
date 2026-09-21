import type { CommunityAgentTranscriptEntry } from "./agent-transcript-contracts.js";
import { parsePlanEntries } from "./agent-transcript-plan.js";

export function canonicalPlanEntry(
  common: { id: string; sequence: number; createdAt: string },
  payload: Record<string, unknown>,
): CommunityAgentTranscriptEntry {
  return {
    ...common,
    type: "plan",
    entries: parsePlanEntries(payload.entries ?? payload.plan_entries),
  };
}
