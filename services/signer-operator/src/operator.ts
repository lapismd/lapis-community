import type {
  OperatorAuditSink,
  OperatorRoundStore,
  OperatorSigningRequest,
  OperatorSigningResponse,
  ThresholdShareEngine,
} from "./types.js";

const hex64 = /^[0-9a-f]{64}$/u;

export class MemoryOperatorRoundStore implements OperatorRoundStore {
  readonly #rounds = new Set<string>();

  async reserve(groupPubkey: string, roundId: string): Promise<boolean> {
    const key = `${groupPubkey}:${roundId}`;
    if (this.#rounds.has(key)) return false;
    this.#rounds.add(key);
    return true;
  }
}

export class SignerOperator {
  readonly #operatorId: string;
  readonly #allowedGroups: ReadonlySet<string>;
  readonly #rounds: OperatorRoundStore;
  readonly #engine: ThresholdShareEngine;
  readonly #audit: OperatorAuditSink;
  readonly #now: () => Date;

  constructor(options: {
    operatorId: string;
    allowedGroupPubkeys: ReadonlySet<string>;
    rounds: OperatorRoundStore;
    engine: ThresholdShareEngine;
    audit: OperatorAuditSink;
    now?: () => Date;
  }) {
    if (options.operatorId.length === 0) {
      throw new Error("Signer operator id is required");
    }
    this.#operatorId = options.operatorId;
    this.#allowedGroups = new Set(options.allowedGroupPubkeys);
    this.#rounds = options.rounds;
    this.#engine = options.engine;
    this.#audit = options.audit;
    this.#now = options.now ?? (() => new Date());
  }

  async createPartial(
    request: OperatorSigningRequest,
  ): Promise<OperatorSigningResponse> {
    if (
      !hex64.test(request.groupPubkey) ||
      !this.#allowedGroups.has(request.groupPubkey) ||
      request.roundId.length < 16 ||
      request.roundId.length > 200 ||
      request.payload.length === 0
    ) {
      await this.#record(request, "rejected");
      throw new Error("Operator signing request is invalid or unauthorized");
    }
    if (!(await this.#rounds.reserve(request.groupPubkey, request.roundId))) {
      await this.#record(request, "rejected");
      throw new Error("Operator signing round was already consumed");
    }

    try {
      const partialSignature = await this.#engine.createPartial(request);
      if (partialSignature.length === 0) {
        throw new Error("Threshold engine returned an empty partial signature");
      }
      await this.#record(request, "accepted");
      return { operatorId: this.#operatorId, partialSignature };
    } catch (error) {
      await this.#record(request, "rejected");
      throw error;
    }
  }

  async #record(
    request: OperatorSigningRequest,
    outcome: "accepted" | "rejected",
  ): Promise<void> {
    await this.#audit.record({
      action: "partial-sign",
      outcome,
      operatorId: this.#operatorId,
      groupPubkey: request.groupPubkey,
      roundId: request.roundId,
      occurredAt: this.#now().toISOString(),
    });
  }
}
