import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { finalizeEvent, getPublicKey, verifyEvent } from "nostr-tools/pure";
import { matchFilter } from "nostr-tools/filter";
import { describe, expect, it, vi } from "vitest";
import type { CommunityRelay, RelayFilter } from "../nostr/index.js";
import type { NostrEvent, NostrEventTemplate } from "../protocol/index.js";
import { createCommunityAgentSession } from "./agent-session.js";

const ownerKey = new Uint8Array(32).fill(61);
const agentKey = new Uint8Array(32).fill(62);
const relayKey = new Uint8Array(32).fill(63);
const owner = getPublicKey(ownerKey);
const agent = getPublicKey(agentKey);
const relayPubkey = getPublicKey(relayKey);
const now = 1_800_000_000;

function setup(nips: (string | number)[] = [29, 44, "OA", "AO"]) {
  const events: NostrEvent[] = [];
  const authorizations = new Set<string>();
  const requests: (RelayFilter & { before_id?: string })[][] = [];
  const fetch = vi.fn<typeof globalThis.fetch>(async (_url, init) => {
    if (init?.method !== "POST")
      return Response.json({ self: relayPubkey, supported_nips: nips });
    const auth = JSON.parse(
      atob(new Headers(init.headers).get("Authorization")!.slice(6)),
    ) as NostrEvent;
    expect(verifyEvent(auth)).toBe(true);
    expect(auth.pubkey).toBe(owner);
    expect(auth.tags).toContainEqual(["u", "https://relay.example/query"]);
    expect(auth.tags).toContainEqual(["method", "POST"]);
    expect(auth.tags).toContainEqual([
      "payload",
      bytesToHex(sha256(new TextEncoder().encode(init.body as string))),
    ]);
    expect(authorizations.has(auth.id)).toBe(false);
    authorizations.add(auth.id);
    const filters = JSON.parse(init.body as string) as (RelayFilter & {
      before_id?: string;
    })[];
    requests.push(filters);
    const result = filters.flatMap((filter) =>
      events
        .filter(
          (event) =>
            matchFilter(filter, event) &&
            (!filter.before_id ||
              event.created_at < filter.until! ||
              event.id < filter.before_id),
        )
        .sort((a, b) => b.created_at - a.created_at || b.id.localeCompare(a.id))
        .slice(0, filter.limit),
    );
    return Response.json([
      ...new Map(result.map((event) => [event.id, event])).values(),
    ]);
  });
  const relay: CommunityRelay = {
    url: "wss://relay.example/",
    query: async () => [],
    close() {},
    publish: vi.fn(async (event) => {
      events.push(event);
      return { accepted: true, message: "" };
    }),
    subscribe: vi.fn(async () => ({ close() {} })),
  };
  const signEvent = vi.fn(async (template: NostrEventTemplate) =>
    finalizeEvent(template, ownerKey),
  );
  const session = createCommunityAgentSession({
    scope: { id: "test", name: "Test", relayUrl: relay.url },
    identity: { getPublicKey: async () => owner, signEvent },
    relay,
    authenticate: async () => {},
    fetch,
    now: () => now,
  });
  return { session, relay, events, requests, fetch, signEvent };
}

describe("agent relay session", () => {
  it("loads an owned agent without channel membership and authenticates every query", async () => {
    const fixture = setup();
    const sig = bytesToHex(
      schnorr.sign(
        sha256(new TextEncoder().encode(`nostr:agent-auth:${agent}:`)),
        ownerKey,
      ),
    );
    fixture.events.push(
      finalizeEvent(
        {
          kind: 0,
          created_at: now,
          tags: [["auth", owner, "", sig]],
          content: '{"name":"Research"}',
        },
        agentKey,
      ),
    );
    fixture.events.push(
      finalizeEvent(
        { kind: 30177, created_at: now, tags: [["d", agent]], content: "{}" },
        ownerKey,
      ),
    );
    const directory = await fixture.session.loadDirectory();
    expect(directory.agents.map((entry) => entry.pubkey)).toEqual([agent]);
    expect(directory.agents[0]?.channelIds).toEqual([]);
    expect(directory.capabilities.activity).toBe(true);
    expect(fixture.requests.flat()).toContainEqual({
      kinds: [0],
      authors: [agent],
      limit: 1,
    });
  });
  it("disables unsupported relays without making agent queries", async () => {
    const fixture = setup([29]);
    expect((await fixture.session.loadDirectory()).capabilities.directory).toBe(
      false,
    );
    expect(fixture.requests).toEqual([]);
  });
  it("paginates a full same-second boundary using before_id", async () => {
    const fixture = setup();
    for (let index = 0; index < 501; index++)
      fixture.events.push(
        finalizeEvent(
          {
            kind: 30177,
            created_at: now,
            tags: [["d", `legacy-${index}`]],
            content: "{}",
          },
          ownerKey,
        ),
      );
    const result = await fixture.session.loadDirectory();
    expect(result.events.filter((event) => event.kind === 30177)).toHaveLength(
      501,
    );
    expect(
      fixture.requests
        .flat()
        .some((filter) => filter.before_id && filter.until === now),
    ).toBe(true);
    expect(result.partial).toBe(false);
  });
  it("preserves contact tags and content across serialized follow and unfollow", async () => {
    const fixture = setup();
    const other = getPublicKey(new Uint8Array(32).fill(64));
    fixture.events.push(
      finalizeEvent(
        {
          kind: 3,
          created_at: now - 1,
          tags: [
            ["p", other, "wss://other.example", "friend"],
            ["client", "Buzz"],
          ],
          content: '{"legacy":"keep"}',
        },
        ownerKey,
      ),
    );
    await Promise.all([
      fixture.session.setFollow(agent, true),
      fixture.session.setFollow(other, false),
    ]);
    const writes = vi
      .mocked(fixture.relay.publish)
      .mock.calls.map(([event]) => event);
    expect(writes).toHaveLength(2);
    expect(writes[0]?.tags).toContainEqual([
      "p",
      other,
      "wss://other.example",
      "friend",
    ]);
    expect(writes[1]?.tags).toEqual([
      ["client", "Buzz"],
      ["p", agent],
    ]);
    expect(writes[1]?.content).toBe('{"legacy":"keep"}');
    expect(writes[1]!.created_at).toBeGreaterThan(writes[0]!.created_at);
  });
  it("never replaces contacts with an empty list when the read fails", async () => {
    const fixture = setup();
    fixture.fetch.mockResolvedValue(new Response("denied", { status: 403 }));
    await expect(fixture.session.setFollow(agent, true)).rejects.toThrow("403");
    expect(fixture.relay.publish).not.toHaveBeenCalled();
  });
  it("propagates signer and relay failures without poisoning subsequent writes", async () => {
    const fixture = setup();
    fixture.signEvent.mockRejectedValueOnce(new Error("Signing declined"));
    await expect(fixture.session.setFollow(agent, true)).rejects.toThrow(
      "Signing declined",
    );
    vi.mocked(fixture.relay.publish).mockResolvedValueOnce({
      accepted: false,
      message: "denied",
    });
    await expect(fixture.session.setFollow(agent, true)).rejects.toThrow(
      "rejected",
    );
    await expect(fixture.session.setFollow(agent, true)).resolves.toMatchObject(
      { kind: 3 },
    );
  });
});
