import type { CommunityAgentsState } from "./agent-contracts.js";
import type { AgentObserverEnvelopeRecord } from "./agent-observer-envelope.js";
import { projectAgentObserverRecords } from "./agent-frame-batch-projection.js";
import { AgentFrameProjection } from "./agent-frame-projection.js";
import { AgentWorkingProjection } from "./agent-working-projection.js";

/** Owns atomic execution and animation projection for decoded telemetry events. */
export class AgentObserverProjection {
  readonly frames = new AgentFrameProjection();
  readonly working = new AgentWorkingProjection();

  apply(
    state: CommunityAgentsState,
    agentPubkey: string,
    records: readonly AgentObserverEnvelopeRecord[],
    now: number,
    observedAt: number | undefined,
    freshnessTimestamp: number,
    live = false,
    snapshot = false,
  ): Partial<CommunityAgentsState> | undefined {
    let patch = projectAgentObserverRecords(
      this.frames,
      state,
      agentPubkey,
      records,
      now * 1_000,
      observedAt,
      live,
      snapshot,
    );
    const projected = patch ? { ...state, ...patch } : state;
    this.working.apply(
      agentPubkey,
      records,
      freshnessTimestamp,
      projected,
      now,
    );
    const working = this.working.state(state.agents, now);
    if (JSON.stringify(working) !== JSON.stringify(state.working))
      patch = { ...patch, working };
    return patch;
  }

  clear(): void {
    this.frames.sequences.clear();
    this.working.clear();
  }
}
