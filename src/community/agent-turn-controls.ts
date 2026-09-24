import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type {
  CommunityAgentControl,
  CommunityAgentObserver,
  CommunityAgentsState,
} from "./agent-contracts.js";
import type {
  AgentTurnTarget,
  AgentTurnControlState,
} from "./agent-turn-control-contracts.js";
import { selectedControllerScope } from "./agent-session-controls.js";
import { observerRecord, observerText } from "./agent-observer.js";

export function turnControlKey(
  agentPubkey: string,
  scopeKey: string,
  target: AgentTurnTarget,
): string {
  return bytesToHex(
    sha256(
      new TextEncoder().encode(
        JSON.stringify([
          agentPubkey,
          scopeKey,
          target.requestId,
          target.sessionId,
          target.turnId,
        ]),
      ),
    ),
  );
}

interface PendingControl {
  promise: Promise<void>;
  resolve(): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout>;
}

/** Correlates owner continuation receipts independently of the selected Activity panel. */
export class AgentTurnControls {
  #closed = false;
  readonly #pending = new Map<string, PendingControl>();
  readonly #states: Record<string, AgentTurnControlState> = {};
  constructor(
    readonly options: {
      state(): CommunityAgentsState;
      send(agent: string, control: CommunityAgentControl): Promise<void>;
      update(states: Record<string, AgentTurnControlState>): void;
    },
  ) {}

  async continue(
    agentPubkey: string,
    scopeKey: string,
    target: AgentTurnTarget,
  ): Promise<void> {
    if (this.#closed)
      throw new Error("Agent controls are unavailable after sign-out");
    const key = turnControlKey(agentPubkey, scopeKey, target);
    const prior = this.#states[key];
    if (prior?.status === "acknowledged") return;
    const pending = this.#pending.get(key);
    if (pending) return pending.promise;
    const scope = selectedControllerScope(
      this.options.state(),
      agentPubkey,
      scopeKey,
      target,
    );
    if (!target.requestId || !target.sessionId || !target.turnId)
      throw new Error(
        "This turn has no verified continuation identity. Refresh activity.",
      );
    if (
      !["failed", "cancelled", "interrupted", "completed"].includes(
        scope.state ?? "",
      )
    )
      throw new Error(
        "Continue requires a stopped task. Resolve uncertain or unavailable execution before retrying.",
      );
    const requestId = `community-continue-${key}`;
    this.#states[key] = {
      agentPubkey,
      scopeKey,
      ...target,
      controlId: requestId,
      status: "pending",
    };
    let resolve!: () => void, reject!: (error: Error) => void;
    const promise = new Promise<void>((ok, fail) => {
      resolve = ok;
      reject = fail;
    });
    // Observe rejection immediately even when a signer remains pending at timeout.
    void promise.catch(() => {});
    const timer = setTimeout(
      () =>
        this.#fail(
          key,
          "The controller has not acknowledged Continue. Retry to check the same request; a new task will not be submitted.",
          "unconfirmed",
        ),
      30000,
    );
    this.#pending.set(key, { promise, resolve, reject, timer });
    this.#publish();
    void this.options
      .send(agentPubkey, {
        version: 2,
        command: "continue_turn",
        requestId,
        targetRequestId: target.requestId,
        scopeKey,
        expectedSessionId: target.sessionId,
        expectedTurnId: target.turnId,
      })
      .catch((cause) =>
        this.#fail(
          key,
          cause instanceof Error
            ? cause.message
            : "Continue could not be sent. Retry the same request.",
          "unconfirmed",
        ),
      );
    return promise;
  }

  accept(agentPubkey: string, frame: CommunityAgentObserver): boolean {
    const payload = observerRecord(frame.payload);
    if (
      frame.kind !== "turn_control_state" &&
      !(
        frame.kind === "administration_error" &&
        payload.responseKind === "turn_control_state"
      )
    )
      return false;
    const entry = Object.entries(this.#states).find(
      ([, state]) =>
        state.agentPubkey === agentPubkey &&
        state.controlId === payload.requestId,
    );
    if (!entry) return true;
    const [key, state] = entry;
    if (frame.kind === "administration_error") {
      if (state.status === "acknowledged") return true;
      this.#fail(
        key,
        observerText(payload.message, 512) ||
          "Continue was rejected. Refresh activity and retry.",
        "error",
      );
      return true;
    }
    if (
      payload.command !== "continue_turn" ||
      payload.targetRequestId !== state.requestId ||
      payload.sessionId !== state.sessionId ||
      !observerText(payload.invocationId, 512) ||
      (state.invocationId !== undefined &&
        payload.invocationId !== state.invocationId) ||
      ([
        "completed",
        "failed",
        "cancelled",
        "interrupted",
        "uncertain",
      ].includes(state.outcome ?? "") &&
        payload.state !== state.outcome) ||
      !observerText(payload.state, 64)
    )
      return true;
    this.#states[key] = {
      ...state,
      status: "acknowledged",
      invocationId: observerText(payload.invocationId, 512),
      message: observerText(payload.message, 512) || "Continuation accepted",
      outcome: observerText(payload.state, 64),
    };
    const pending = this.#pending.get(key);
    if (pending) {
      clearTimeout(pending.timer);
      this.#pending.delete(key);
      pending.resolve();
    }
    this.#publish();
    return true;
  }

  dispose(): void {
    this.#closed = true;
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(
        new Error(
          "Agent control was cancelled locally; refresh activity to inspect the controller outcome.",
        ),
      );
    }
    this.#pending.clear();
  }
  #fail(key: string, message: string, status: "error" | "unconfirmed"): void {
    if (this.#closed) return;
    const state = this.#states[key];
    if (!state || state.status === "acknowledged") return;
    this.#states[key] = { ...state, status, message };
    const pending = this.#pending.get(key);
    if (pending) {
      clearTimeout(pending.timer);
      this.#pending.delete(key);
      pending.reject(new Error(message));
    }
    this.#publish();
  }
  #publish(): void {
    this.options.update({ ...this.#states });
  }
}

export function turnControlFailure(
  control: AgentTurnControlState,
): string | undefined {
  if (control.status === "error" || control.status === "unconfirmed")
    return (
      control.message ??
      "Continue could not be confirmed. Refresh activity and retry."
    );
  if (
    control.status === "acknowledged" &&
    ["failed", "cancelled", "interrupted", "uncertain"].includes(
      control.outcome ?? "",
    )
  )
    return (
      control.message ||
      `Continuation ${control.outcome}. Open the new attempt in Activity for details.`
    );
}
