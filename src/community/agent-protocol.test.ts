import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
import { describe, expect, it } from "vitest";
import {
  agentOwner,
  materializeAgentDirectory,
  parseAgentObserver,
  validateAgentTelemetry,
  verifyAgentCredential,
} from "./agent-protocol.js";

const ownerKey = new Uint8Array(32).fill(61);
const agentKey = new Uint8Array(32).fill(62);
const relayKey = new Uint8Array(32).fill(63);
const owner = getPublicKey(ownerKey);
const agent = getPublicKey(agentKey);
const relay = getPublicKey(relayKey);
const now = 1_800_000_000;

function profile(conditions = "", created_at = now) {
  const sig = bytesToHex(
    schnorr.sign(
      sha256(
        new TextEncoder().encode(`nostr:agent-auth:${agent}:${conditions}`),
      ),
      ownerKey,
    ),
  );
  return finalizeEvent(
    {
      kind: 0,
      created_at,
      content: JSON.stringify({
        name: "Research agent",
        about: "Reads source",
      }),
      tags: [["auth", owner, conditions, sig]],
    },
    agentKey,
  );
}

describe("agent ownership and protocol", () => {
  it("matches the published Buzz and Go relay owner-attestation vector", () => {
    const credential = verifyAgentCredential(
      [
        "auth",
        "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
        "kind=1&created_at<1713957000",
        "8b7df2575caf0a108374f8471722b233c53f9ff827a8b0f91861966c3b9dd5cb2e189eae9f49d72187674c2f5bd244145e10ff86c9f257ffe65a1ee5f108b369",
      ],
      "c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5",
    );
    expect(credential?.ownerPubkey).toBe(
      "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
    );
    expect(
      agentOwner(profile("kind=0&created_at>1799999999&created_at<1800000001")),
    ).toBe(owner);
  });
  it.each([
    "kind=00",
    "kind=1",
    "kind=0&kind=1",
    "created_at<1800000000",
    "created_at>1800000000",
    "kind=65536",
    "kind=0&",
    "kind=0 ",
  ])("rejects invalid or unsatisfied conditions: %s", (condition) => {
    expect(agentOwner(profile(condition))).toBeUndefined();
  });
  it("rejects tampering, duplicate credentials and self-attestation", () => {
    expect(agentOwner({ ...profile(), content: "tampered" })).toBeUndefined();
    const event = profile();
    expect(
      agentOwner(
        finalizeEvent(
          { ...event, tags: [...event.tags, ...event.tags] },
          agentKey,
        ),
      ),
    ).toBeUndefined();
    expect(
      verifyAgentCredential(["auth", agent, "", "0".repeat(128)], agent),
    ).toBeUndefined();
  });
  it("uses the newest profile even when its owner proof has been removed", () => {
    const before = profile();
    const after = finalizeEvent(
      { kind: 0, created_at: now + 1, content: "{}", tags: [] },
      agentKey,
    );
    expect(materializeAgentDirectory([before, after], owner, relay)).toEqual(
      [],
    );
  });
  it("requires ownership and relay-authoritative membership, never metadata claims", () => {
    const discovery = finalizeEvent(
      {
        kind: 30177,
        created_at: now,
        tags: [["d", agent]],
        content: JSON.stringify({ channel_ids: ["forged"] }),
      },
      ownerKey,
    );
    const membership = finalizeEvent(
      {
        kind: 39002,
        created_at: now,
        content: "",
        tags: [
          ["d", "general"],
          ["p", owner],
          ["p", agent, "member"],
        ],
      },
      relayKey,
    );
    const forged = finalizeEvent(
      {
        ...membership,
        tags: [
          ["d", "forged"],
          ["p", owner],
          ["p", agent],
        ],
      },
      agentKey,
    );
    expect(materializeAgentDirectory([discovery], owner, relay)).toEqual([]);
    const result = materializeAgentDirectory(
      [profile(), discovery, membership, forged],
      owner,
      relay,
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.channelIds).toEqual(["general"]);
    expect(result[0]?.name).toBe("Research agent");
  });
  it("honours signed profile deletions and rejects foreign deletions", () => {
    const event = profile();
    const deletion = finalizeEvent(
      {
        kind: 5,
        created_at: now + 1,
        content: "",
        tags: [["a", `0:${agent}:`]],
      },
      agentKey,
    );
    expect(materializeAgentDirectory([event, deletion], owner, relay)).toEqual(
      [],
    );
    expect(
      materializeAgentDirectory(
        [event, finalizeEvent(deletion, ownerKey)],
        owner,
        relay,
      ),
    ).toHaveLength(1);
  });
  it("accepts only fresh, exact-route owner telemetry", () => {
    const event = finalizeEvent(
      {
        kind: 24200,
        created_at: now,
        tags: [
          ["p", owner],
          ["agent", agent],
          ["frame", "telemetry"],
        ],
        content: "A".repeat(132),
      },
      agentKey,
    );
    expect(validateAgentTelemetry(event, profile(), owner, now)).toBe(true);
    expect(validateAgentTelemetry(event, profile(), relay, now)).toBe(false);
    expect(validateAgentTelemetry(event, profile(), owner, now + 301)).toBe(
      false,
    );
    expect(
      validateAgentTelemetry(
        finalizeEvent(
          { ...event, tags: [...event.tags, ["p", owner]] },
          agentKey,
        ),
        profile(),
        owner,
        now,
      ),
    ).toBe(false);
  });
  it("parses Buzz observer frames without trusting arbitrary payload shapes", () => {
    expect(
      parseAgentObserver(
        JSON.stringify({
          seq: 1,
          timestamp: "2026-09-11T00:00:00Z",
          kind: "turn_started",
          channelId: null,
          sessionId: "s",
          turnId: "t",
          payload: {},
        }),
      )?.kind,
    ).toBe("turn_started");
    expect(parseAgentObserver('{"seq":1}')).toBeUndefined();
    expect(
      parseAgentObserver(
        JSON.stringify({
          seq: Number.MAX_SAFE_INTEGER + 1,
          timestamp: "now",
          kind: "turn_started",
          payload: {},
        }),
      ),
    ).toBeUndefined();
  });
});
