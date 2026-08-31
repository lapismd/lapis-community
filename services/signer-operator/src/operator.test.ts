import { describe, expect, it, vi } from "vitest";

import { MemoryOperatorRoundStore, SignerOperator } from "./index.js";
import type { OperatorAuditSink } from "./index.js";

const groupPubkey = "a".repeat(64);
const roundId = "round-0000000000000001";

function harness() {
  const entries: Parameters<OperatorAuditSink["record"]>[0][] = [];
  const engine = {
    createPartial: vi.fn(async () => "opaque-partial-signature"),
  };
  const operator = new SignerOperator({
    operatorId: "operator-one",
    allowedGroupPubkeys: new Set([groupPubkey]),
    rounds: new MemoryOperatorRoundStore(),
    engine,
    audit: {
      record: async (entry) => {
        entries.push(structuredClone(entry));
      },
    },
    now: () => new Date("2026-08-31T17:00:00.000Z"),
  });
  return { operator, engine, entries };
}

describe("signer operator", () => {
  it("creates one opaque partial without exposing its share to the caller", async () => {
    const { operator, engine, entries } = harness();
    const response = await operator.createPartial({
      roundId,
      groupPubkey,
      payload: "opaque-round-payload",
    });

    expect(response).toEqual({
      operatorId: "operator-one",
      partialSignature: "opaque-partial-signature",
    });
    expect(engine.createPartial).toHaveBeenCalledOnce();
    expect(JSON.stringify(entries)).not.toContain("opaque-round-payload");
    expect(JSON.stringify(entries)).not.toContain("opaque-partial-signature");
  });

  it("burns a round before signing and refuses nonce reuse", async () => {
    const { operator, engine } = harness();
    const request = {
      roundId,
      groupPubkey,
      payload: "opaque-round-payload",
    };

    await operator.createPartial(request);
    await expect(operator.createPartial(request)).rejects.toThrow(
      "already consumed",
    );
    expect(engine.createPartial).toHaveBeenCalledOnce();
  });

  it("rejects an unconfigured group before calling the share engine", async () => {
    const { operator, engine } = harness();

    await expect(
      operator.createPartial({
        roundId,
        groupPubkey: "b".repeat(64),
        payload: "opaque-round-payload",
      }),
    ).rejects.toThrow("invalid or unauthorized");
    expect(engine.createPartial).not.toHaveBeenCalled();
  });
});
