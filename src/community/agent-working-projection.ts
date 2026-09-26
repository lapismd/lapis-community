import type {
  CommunityAgentIdentity,
  CommunityAgentObserver,
  CommunityAgentsState,
} from "./agent-contracts.js";
import type { AgentObserverEnvelopeRecord } from "./agent-observer-envelope.js";
import { observerRecord, observerText } from "./agent-observer.js";
import {
  activityPayloadState,
  activityScopeStorageKey,
} from "./activity-frame-state.js";
import { turnFrameIsTerminal, turnIsTerminal } from "./agent-turn-state.js";

interface WorkingTurnFrame {
  until: number;
  timestamp: number;
  cursorSeq: number;
  recordSeq: number;
  streamId?: string;
}

/** Projects bounded working animation separately from durable execution state. */
export class AgentWorkingProjection {
  readonly #turns = new Map<string, Map<string, WorkingTurnFrame>>();
  readonly #typing = new Map<string, number>();

  markTyping(agentPubkey: string, until: number): void {
    this.#typing.set(agentPubkey, until);
  }

  apply(
    agentPubkey: string,
    records: readonly AgentObserverEnvelopeRecord[],
    freshnessTimestamp: number,
    projectedState: CommunityAgentsState,
    now: number,
  ): void {
    for (const { cursorSeq, frame } of records)
      this.#applyFrame(
        agentPubkey,
        frame,
        cursorSeq,
        freshnessTimestamp,
        projectedState,
        now,
      );
  }

  state(
    agents: readonly CommunityAgentIdentity[],
    now: number,
  ): Record<string, boolean> {
    return Object.fromEntries(
      agents.map((agent) => [
        agent.pubkey,
        Math.max(
          ...[...(this.#turns.get(agent.pubkey)?.values() ?? [])].map(
            (turn) => turn.until,
          ),
          this.#typing.get(agent.pubkey) ?? 0,
        ) > now,
      ]),
    );
  }

  clear(): void {
    this.#turns.clear();
    this.#typing.clear();
  }

  retainAgents(allowed: ReadonlySet<string>): void {
    for (const key of this.#turns.keys())
      if (!allowed.has(key)) this.#turns.delete(key);
    for (const key of this.#typing.keys())
      if (!allowed.has(key)) this.#typing.delete(key);
  }

  #applyFrame(
    agentPubkey: string,
    frame: CommunityAgentObserver,
    cursorSeq: number,
    freshnessTimestamp: number,
    projectedState: CommunityAgentsState,
    now: number,
  ): void {
    const turns =
      this.#turns.get(agentPubkey) ?? new Map<string, WorkingTurnFrame>();
    const payload = observerRecord(frame.payload);
    const turnKey = JSON.stringify([
      payload.lifecycleRequestId ?? frame.turnId,
      payload.scopeKey ?? frame.channelId,
    ]);
    const timestamp = Date.parse(frame.timestamp);
    const previous = turns.get(turnKey);
    if (
      previous &&
      ((frame.streamId === previous.streamId &&
        (cursorSeq < previous.cursorSeq ||
          (cursorSeq === previous.cursorSeq &&
            frame.seq <= previous.recordSeq))) ||
        (frame.streamId !== previous.streamId &&
          timestamp < previous.timestamp))
    )
      return;
    const executionState = activityPayloadState(
      frame.kind,
      turnFrameIsTerminal(frame.kind),
      observerText(payload.state, 40),
      observerText(payload.preview, 240),
    );
    const terminal =
      turnIsTerminal(executionState) || frame.kind === "agent_stopped";
    const scopeKey = observerText(payload.scopeKey, 4_096);
    const requestId =
      observerText(payload.lifecycleRequestId, 512) ||
      observerText(payload.requestId, 512) ||
      frame.turnId ||
      "";
    const scope =
      projectedState.conversationScopes?.[
        activityScopeStorageKey(agentPubkey, scopeKey, requestId)
      ];
    const settled =
      !terminal &&
      scope?.requestId === requestId &&
      turnIsTerminal(scope.state);
    if (frame.kind === "agent_stopped") turns.clear();
    const status =
      ["request_status", "turn_started"].includes(frame.kind) ||
      frame.kind.startsWith("permission_");
    const until =
      !terminal &&
      !settled &&
      (status ? executionState === "running" : (previous?.until ?? 0) > now)
        ? Math.min(now + 180, freshnessTimestamp + 180)
        : 0;
    turns.set(turnKey, {
      until,
      timestamp,
      cursorSeq,
      recordSeq: frame.seq,
      ...(frame.streamId ? { streamId: frame.streamId } : {}),
    });
    if (turns.size > 512) turns.delete(turns.keys().next().value!);
    this.#turns.set(agentPubkey, turns);
    if (terminal) this.#typing.delete(agentPubkey);
  }
}
