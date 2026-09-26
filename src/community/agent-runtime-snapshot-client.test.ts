import { afterEach, expect, it, vi } from "vitest";
import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
import * as nip44 from "nostr-tools/nip44";
import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { AgentRuntimeSnapshots } from "./agent-runtime-snapshot-client.js";
import type {
  CommunityAgentIdentity,
  CommunityAgentRuntimeState,
} from "./agent-contracts.js";
import type { NostrEvent } from "../protocol/nostr-event.js";
import type {
  RuntimeRefreshRequest,
  CommunityRuntimeRefreshState,
} from "./agent-runtime-snapshot-protocol.js";
const ownerKey = new Uint8Array(32).fill(71),
  agentKey = new Uint8Array(32).fill(72);
const owner = getPublicKey(ownerKey),
  agent = getPublicKey(agentKey),
  now = 1800000100000;
const conversation = nip44.v2.utils.getConversationKey(agentKey, owner);
const profile = finalizeEvent(
  {
    kind: 0,
    created_at: now / 1000,
    content: '{"name":"Research"}',
    tags: [
      [
        "auth",
        owner,
        "",
        bytesToHex(
          schnorr.sign(
            sha256(new TextEncoder().encode(`nostr:agent-auth:${agent}:`)),
            ownerKey,
          ),
        ),
      ],
    ],
  },
  agentKey,
);
const identity: CommunityAgentIdentity = {
  pubkey: agent,
  profile,
  ownerPubkey: owner,
  name: "Research",
  about: "",
  agentType: "assistant",
  channelIds: [],
  followed: false,
  personaStatus: "none",
};
const runtime: CommunityAgentRuntimeState = {
  agentId: "research",
  host: { id: "host", kind: "managed" },
  runtimeAgents: [{ id: "codex", label: "Codex" }],
  configured: { runtimeAgent: "codex" },
  effective: { runtimeAgent: "codex" },
  catalog: { agent: "codex", models: ["enabled"], configOptions: [] },
  tools: [],
  memory: { enabled: false, candidates: 0 },
};
const clients: AgentRuntimeSnapshots[] = [];
afterEach(() => {
  clients.splice(0).forEach((client) => client.dispose());
  vi.useRealTimers();
});
function requestEvent(value: RuntimeRefreshRequest) {
  return finalizeEvent(
    {
      kind: 30181,
      created_at: Math.floor(value.requestedAt / 1000),
      tags: [
        ["p", agent],
        ["d", agent],
        ["agent", agent],
      ],
      content: nip44.v2.encrypt(JSON.stringify(value), conversation),
    },
    ownerKey,
  );
}
function snapshot(
  revision: number,
  stamp: number,
  request?: NostrEvent,
  data = runtime,
) {
  const ack = request
    ? {
        eventId: request.id,
        requestId: JSON.parse(nip44.v2.decrypt(request.content, conversation))
          .requestId,
        status: "completed",
      }
    : undefined;
  return finalizeEvent(
    {
      kind: 30180,
      created_at: Math.floor(stamp / 1000),
      tags: [
        ["p", owner],
        ["d", owner],
        ["agent", agent],
      ],
      content: nip44.v2.encrypt(
        JSON.stringify({
          version: 1,
          revision,
          observedAt: stamp,
          runtime: data,
          ...(ack ? { request: ack } : {}),
        }),
        conversation,
      ),
    },
    agentKey,
  );
}
function setup() {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  const sent: NostrEvent[] = [],
    changes: Array<{
      runtime: CommunityAgentRuntimeState | undefined;
      state: CommunityRuntimeRefreshState;
    }> = [];
  const options = {
    owner,
    now: () => Date.now(),
    agent: (key: string) => (key === agent ? identity : undefined),
    relay: () => undefined,
    decrypt: async (_peer: string, content: string) =>
      nip44.v2.decrypt(content, conversation),
    send: vi.fn(async (_agent: string, value: RuntimeRefreshRequest) => {
      const event = requestEvent(value);
      sent.push(event);
      return event;
    }),
    legacy: vi.fn(() => new Promise<CommunityAgentRuntimeState>(() => {})),
    update: (
      _agent: string,
      runtime: CommunityAgentRuntimeState | undefined,
      state: CommunityRuntimeRefreshState,
    ) => {
      changes.push({ runtime, state });
    },
  };
  const client = new AgentRuntimeSnapshots(options);
  clients.push(client);
  return { client, options, sent, changes };
}
it("hydrates old encrypted snapshots immediately and ignores stale or duplicate heads", async () => {
  const h = setup();
  const old = snapshot(1, now - 86400000);
  await h.client.receive(old);
  expect(h.changes.at(-1)?.runtime).toEqual(runtime);
  await h.client.receive(snapshot(2, now));
  await h.client.receive(old);
  expect(h.changes.at(-1)?.state.revision).toBe(2);
  const count = h.changes.length;
  await h.client.receive(old);
  expect(h.changes).toHaveLength(count);
});
it("preserves cached runtime through timeout, then accepts a late result", async () => {
  const h = setup();
  await h.client.receive(snapshot(1, now - 10000));
  const loaded = h.client.load(agent);
  const rejection = expect(loaded).rejects.toThrow("thirty seconds");
  await vi.advanceTimersByTimeAsync(1);
  expect(h.client.state(agent).status).toBe("pending");
  expect(h.changes.at(-1)?.runtime).toEqual(runtime);
  await vi.advanceTimersByTimeAsync(30000);
  h.client.tick();
  await rejection;
  expect(h.client.state(agent).status).toBe("timed-out");
  await h.client.receive(snapshot(2, Date.now(), h.sent[0]));
  expect(h.client.state(agent).status).toBe("completed");
  expect(h.changes.at(-1)?.runtime).toEqual(runtime);
});
it("restores pending requests in a second tab and avoids another publication", async () => {
  const a = setup(),
    b = setup();
  await a.client.refresh(agent);
  await b.client.receive(a.sent[0]!);
  await b.client.refresh(agent);
  expect(b.sent).toHaveLength(0);
  await b.client.receive(snapshot(1, now, a.sent[0]));
  expect(b.client.state(agent).status).toBe("completed");
});
it("an older acknowledgement cannot settle a newer request", async () => {
  const h = setup();
  await h.client.refresh(agent);
  const first = h.sent[0]!;
  const second = requestEvent({
    version: 1,
    requestId: "second",
    requestedAt: now + 1000,
    expiresAt: now + 31000,
  });
  await h.client.receive(second);
  await h.client.receive(snapshot(1, now + 2000, first));
  expect(h.client.state(agent).status).toBe("pending");
  await h.client.receive(snapshot(2, now + 3000, second));
  expect(h.client.state(agent).status).toBe("completed");
});
it("rejects malformed routing, ciphertext, and decreasing revisions", async () => {
  const h = setup();
  const good = snapshot(4, now);
  await h.client.receive(good);
  const bad = finalizeEvent(
    { ...good, tags: [...good.tags, ["p", owner]], created_at: now / 1000 + 1 },
    agentKey,
  );
  await h.client.receive(bad);
  await h.client.receive(snapshot(3, now + 2000));
  expect(h.changes).toHaveLength(1);
});
it("coalesces concurrent loads and reports signer failure without deleting the cache", async () => {
  const h = setup();
  await h.client.receive(snapshot(1, now));
  h.options.send.mockRejectedValueOnce(new Error("Signer unavailable"));
  await expect(h.client.load(agent)).rejects.toThrow("Signer unavailable");
  expect(h.changes.at(-1)?.runtime).toEqual(runtime);
  const first = h.client.load(agent),
    second = h.client.load(agent);
  await vi.advanceTimersByTimeAsync(1);
  expect(h.sent).toHaveLength(1);
  await h.client.receive(snapshot(2, now + 1000, h.sent[0]));
  expect(await first).toEqual(runtime);
  expect(await second).toEqual(runtime);
});

it("rejects a compatibility load when current-head retrieval fails", async () => {
  const h = setup();
  Object.assign(h.options, {
    loadHeads: async () => {
      throw new Error("Relay unavailable");
    },
  });
  await expect(h.client.load(agent)).rejects.toThrow("Relay unavailable");
  expect(h.sent).toHaveLength(0);
});
it("selects the lower event id for competing same-second requests", async () => {
  const h = setup();
  const heads = ["tab-a", "tab-b"]
    .map((requestId) =>
      requestEvent({
        version: 1,
        requestId,
        requestedAt: now,
        expiresAt: now + 30000,
      }),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  await h.client.receive(heads[1]!);
  await h.client.receive(heads[0]!);
  await h.client.receive(snapshot(1, now + 1000, heads[1]));
  expect(h.client.state(agent)).toMatchObject({
    eventId: heads[0]!.id,
    status: "pending",
  });
  await h.client.receive(snapshot(2, now + 2000, heads[0]));
  expect(h.client.state(agent).status).toBe("completed");
});
it("forgets runtime state and rejects pending loads when an agent is removed", async () => {
  const h = setup();
  await h.client.receive(snapshot(1, now));
  const loading = h.client.load(agent);
  const rejected = expect(loading).rejects.toThrow("no longer available");
  await vi.advanceTimersByTimeAsync(1);
  h.client.retain(new Set());
  await rejected;
  expect(h.client.hasSnapshot(agent)).toBe(false);
});

it("rejects a compatibility load for an unavailable agent", async () => {
  const h = setup();
  await expect(h.client.load("unknown")).rejects.toThrow(
    "current verified agent",
  );
  expect(h.sent).toHaveLength(0);
});
