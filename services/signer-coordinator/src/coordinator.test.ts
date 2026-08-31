import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from "nostr-tools/pure";
import { describe, expect, it, vi } from "vitest";

import { MemoryCoordinatorRoundStore, SignerCoordinator } from "./index.js";
import type {
  CoordinatorAuditSink,
  CoordinatorGroupProfile,
  ThresholdCoordinatorEngine,
  ThresholdOperatorClient,
} from "./index.js";

const template = {
  kind: 1,
  created_at: 1_800_000_000,
  tags: [["t", "threshold-fixture"]],
  content: "exact signing request",
};

function harness(options: {
  failures?: ReadonlySet<string>;
  invalid?: ReadonlySet<string>;
  mutateFinal?: boolean;
  roundId?: () => string;
}) {
  const secret = generateSecretKey();
  const groupPubkey = getPublicKey(secret);
  const group: CoordinatorGroupProfile = {
    groupPubkey,
    threshold: 2,
    operators: ["one", "two", "three"].map((operatorId) => ({
      operatorId,
      endpoint: `https://${operatorId}.signer.example.test`,
      publicCommitment: `commitment-${operatorId}`,
    })),
  };
  const operators: ThresholdOperatorClient[] = group.operators.map(
    (profile) => ({
      operatorId: profile.operatorId,
      createPartial: vi.fn(async () => {
        if (options.failures?.has(profile.operatorId) === true) {
          throw new Error("operator unavailable");
        }
        return {
          operatorId: profile.operatorId,
          partialSignature:
            options.invalid?.has(profile.operatorId) === true
              ? `invalid:${profile.operatorId}`
              : `valid:${profile.operatorId}`,
        };
      }),
    }),
  );
  const engine: ThresholdCoordinatorEngine = {
    prepare: vi.fn(async () => ({
      context: "opaque-coordinator-context",
      operatorPayloads: new Map(
        group.operators.map((profile) => [
          profile.operatorId,
          `opaque-payload:${profile.operatorId}`,
        ]),
      ),
    })),
    verifyPartial: vi.fn(async ({ partialSignature }) =>
      partialSignature.startsWith("valid:"),
    ),
    aggregate: vi.fn(async () =>
      finalizeEvent(
        options.mutateFinal ? { ...template, content: "mutated" } : template,
        secret,
      ),
    ),
  };
  const entries: Parameters<CoordinatorAuditSink["record"]>[0][] = [];
  const coordinator = new SignerCoordinator({
    group,
    operators,
    rounds: new MemoryCoordinatorRoundStore(),
    engine,
    audit: {
      record: async (entry) => {
        entries.push(structuredClone(entry));
      },
    },
    roundId: options.roundId ?? (() => "round-0000000000000001"),
    now: () => new Date("2026-08-31T17:00:00.000Z"),
  });
  return { coordinator, engine, operators, entries, groupPubkey };
}

describe("signer coordinator", () => {
  it("produces an exact event with two of three operators when one is offline", async () => {
    const { coordinator, engine, entries, groupPubkey } = harness({
      failures: new Set(["two"]),
    });

    await expect(coordinator.signEvent(template)).resolves.toMatchObject({
      pubkey: groupPubkey,
      kind: template.kind,
      content: template.content,
    });
    expect(engine.aggregate).toHaveBeenCalledWith({
      context: "opaque-coordinator-context",
      partials: new Map([
        ["one", "valid:one"],
        ["three", "valid:three"],
      ]),
    });
    expect(entries.at(-1)).toMatchObject({
      outcome: "accepted",
      participatingOperatorIds: ["one", "three"],
    });
    expect(JSON.stringify(entries)).not.toMatch(/opaque-payload|valid:/u);
  });

  it("rejects invalid partials when the remaining valid set is below quorum", async () => {
    const { coordinator, engine } = harness({
      failures: new Set(["three"]),
      invalid: new Set(["two"]),
    });

    await expect(coordinator.signEvent(template)).rejects.toThrow(
      "quorum failed: 1/2",
    );
    expect(engine.aggregate).not.toHaveBeenCalled();
  });

  it("reserves rounds before contacting operators and refuses reuse", async () => {
    const fixedRound = () => "round-0000000000000001";
    const { coordinator, operators } = harness({ roundId: fixedRound });

    await coordinator.signEvent(template);
    await expect(coordinator.signEvent(template)).rejects.toThrow(
      "already consumed",
    );
    for (const operator of operators) {
      expect(operator.createPartial).toHaveBeenCalledOnce();
    }
  });

  it("rejects an aggregate signature over a mutated event", async () => {
    const { coordinator } = harness({ mutateFinal: true });

    await expect(coordinator.signEvent(template)).rejects.toThrow(
      "non-matching Nostr event",
    );
  });
});
