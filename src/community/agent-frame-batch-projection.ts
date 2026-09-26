import type { CommunityAgentsState } from "./agent-contracts.js";
import type { AgentObserverEnvelopeRecord } from "./agent-observer-envelope.js";
import { AgentFrameProjection } from "./agent-frame-projection.js";

/** Fold one decoded encrypted event before exposing a single state patch. */
export function projectAgentObserverRecords(
  projection: AgentFrameProjection,
  state: CommunityAgentsState,
  agentPubkey: string,
  records: readonly AgentObserverEnvelopeRecord[],
  nowMs: number,
  observedAt?: number,
  live = false,
  snapshot = false,
): Partial<CommunityAgentsState> | undefined {
  let current = state;
  const touched = new Set<keyof CommunityAgentsState>();
  for (const { cursorSeq, frame } of records) {
    const patch = projection.apply(
      current,
      agentPubkey,
      frame,
      nowMs,
      observedAt,
      live,
      snapshot,
      { cursorSeq, recordSeq: frame.seq },
    );
    if (!patch) continue;
    current = { ...current, ...patch };
    for (const key of Object.keys(patch) as (keyof CommunityAgentsState)[])
      touched.add(key);
  }
  if (touched.size === 0) return;
  return Object.fromEntries(
    [...touched].map((key) => [key, current[key]]),
  ) as Partial<CommunityAgentsState>;
}
