import { randomUUID } from "node:crypto";

import { canonicalJson } from "@lapismd/registry-protocol";
import type {
  JsonValue,
  NostrEvent,
  NostrEventTemplate,
} from "@lapismd/registry-protocol";
import { verifyEvent } from "nostr-tools/pure";

import type {
  CoordinatorAuditSink,
  CoordinatorGroupProfile,
  CoordinatorRoundStore,
  ThresholdCoordinatorEngine,
  ThresholdOperatorClient,
} from "./types.js";

const hex64 = /^[0-9a-f]{64}$/u;

export class MemoryCoordinatorRoundStore implements CoordinatorRoundStore {
  readonly #rounds = new Set<string>();

  async reserve(groupPubkey: string, roundId: string): Promise<boolean> {
    const key = `${groupPubkey}:${roundId}`;
    if (this.#rounds.has(key)) return false;
    this.#rounds.add(key);
    return true;
  }
}

export class SignerCoordinator {
  readonly #group: CoordinatorGroupProfile;
  readonly #operators: ReadonlyMap<string, ThresholdOperatorClient>;
  readonly #rounds: CoordinatorRoundStore;
  readonly #engine: ThresholdCoordinatorEngine;
  readonly #audit: CoordinatorAuditSink;
  readonly #roundId: () => string;
  readonly #now: () => Date;

  constructor(options: {
    group: CoordinatorGroupProfile;
    operators: readonly ThresholdOperatorClient[];
    rounds: CoordinatorRoundStore;
    engine: ThresholdCoordinatorEngine;
    audit: CoordinatorAuditSink;
    roundId?: () => string;
    now?: () => Date;
  }) {
    validateGroup(options.group);
    this.#group = structuredClone(options.group);
    this.#operators = new Map(
      options.operators.map((operator) => [operator.operatorId, operator]),
    );
    if (
      this.#operators.size !== options.operators.length ||
      options.group.operators.some(
        (operator) => !this.#operators.has(operator.operatorId),
      )
    ) {
      throw new Error("Coordinator clients must exactly cover group operators");
    }
    this.#rounds = options.rounds;
    this.#engine = options.engine;
    this.#audit = options.audit;
    this.#roundId = options.roundId ?? randomUUID;
    this.#now = options.now ?? (() => new Date());
  }

  async signEvent(template: NostrEventTemplate): Promise<NostrEvent> {
    const roundId = this.#roundId();
    if (roundId.length < 16 || roundId.length > 200) {
      throw new Error("Coordinator generated an invalid signing round id");
    }
    if (!(await this.#rounds.reserve(this.#group.groupPubkey, roundId))) {
      await this.#record(roundId, "rejected", []);
      throw new Error("Coordinator signing round was already consumed");
    }

    const participatingOperatorIds: string[] = [];
    try {
      const prepared = await this.#engine.prepare({
        roundId,
        group: this.#group,
        template,
      });
      const responses = await Promise.allSettled(
        this.#group.operators.map(async (profile) => {
          const payload = prepared.operatorPayloads.get(profile.operatorId);
          if (payload === undefined || payload.length === 0) {
            throw new Error(
              `Missing payload for operator ${profile.operatorId}`,
            );
          }
          const response = await this.#operators
            .get(profile.operatorId)!
            .createPartial({
              roundId,
              groupPubkey: this.#group.groupPubkey,
              payload,
            });
          if (response.operatorId !== profile.operatorId) {
            throw new Error(
              "Operator response identity does not match request",
            );
          }
          if (
            !(await this.#engine.verifyPartial({
              context: prepared.context,
              operator: profile,
              partialSignature: response.partialSignature,
            }))
          ) {
            throw new Error(
              `Invalid partial from operator ${profile.operatorId}`,
            );
          }
          return response;
        }),
      );
      const valid = responses
        .filter(
          (
            response,
          ): response is PromiseFulfilledResult<{
            operatorId: string;
            partialSignature: string;
          }> => response.status === "fulfilled",
        )
        .map((response) => response.value)
        .toSorted((left, right) =>
          left.operatorId.localeCompare(right.operatorId),
        );
      if (valid.length < this.#group.threshold) {
        throw new Error(
          `Threshold signing quorum failed: ${valid.length}/${this.#group.threshold}`,
        );
      }
      const selected = valid.slice(0, this.#group.threshold);
      participatingOperatorIds.push(
        ...selected.map((response) => response.operatorId),
      );
      const event = await this.#engine.aggregate({
        context: prepared.context,
        partials: new Map(
          selected.map((response) => [
            response.operatorId,
            response.partialSignature,
          ]),
        ),
      });
      assertExactEvent(template, event, this.#group.groupPubkey);
      await this.#record(roundId, "accepted", participatingOperatorIds);
      return event;
    } catch (error) {
      await this.#record(roundId, "rejected", participatingOperatorIds);
      throw error;
    }
  }

  async #record(
    roundId: string,
    outcome: "accepted" | "rejected",
    participatingOperatorIds: string[],
  ): Promise<void> {
    await this.#audit.record({
      action: "threshold-sign",
      outcome,
      groupPubkey: this.#group.groupPubkey,
      roundId,
      participatingOperatorIds: [...participatingOperatorIds].sort(),
      occurredAt: this.#now().toISOString(),
    });
  }
}

function validateGroup(group: CoordinatorGroupProfile): void {
  if (!hex64.test(group.groupPubkey)) {
    throw new Error("Coordinator group pubkey must be 32-byte lowercase hex");
  }
  if (
    !Number.isInteger(group.threshold) ||
    group.threshold < 2 ||
    group.threshold > group.operators.length
  ) {
    throw new Error(
      "Coordinator group requires a valid threshold of at least two",
    );
  }
  if (group.operators.length < 3) {
    throw new Error("Coordinator group requires at least three operators");
  }
  const ids = new Set<string>();
  for (const operator of group.operators) {
    if (
      operator.operatorId.length === 0 ||
      operator.publicCommitment.length === 0 ||
      ids.has(operator.operatorId)
    ) {
      throw new Error("Coordinator operators require unique public identities");
    }
    const endpoint = new URL(operator.endpoint);
    if (
      endpoint.protocol !== "https:" ||
      endpoint.username ||
      endpoint.password ||
      endpoint.hash
    ) {
      throw new Error(
        "Coordinator operator endpoints must use safe HTTPS URLs",
      );
    }
    ids.add(operator.operatorId);
  }
}

function assertExactEvent(
  template: NostrEventTemplate,
  event: NostrEvent,
  groupPubkey: string,
): void {
  if (
    event.pubkey !== groupPubkey ||
    event.kind !== template.kind ||
    event.created_at !== template.created_at ||
    event.content !== template.content ||
    canonicalJson(event.tags as unknown as JsonValue) !==
      canonicalJson(template.tags as unknown as JsonValue) ||
    !verifyEvent(event)
  ) {
    throw new Error("Threshold engine returned a non-matching Nostr event");
  }
}
