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

function setup(
  nips: (string | number)[] = [29, 44, "OA", "AO"],
  signerNip44 = true,
) {
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
  const nip44 = {
    encrypt: vi.fn(async (_pubkey: string, plaintext: string) =>
      btoa(plaintext),
    ),
    decrypt: vi.fn(async (_pubkey: string, ciphertext: string) =>
      atob(ciphertext),
    ),
  };
  const session = createCommunityAgentSession({
    scope: { id: "test", name: "Test", relayUrl: relay.url },
    identity: {
      getPublicKey: async () => owner,
      signEvent,
      ...(signerNip44 ? { nip44 } : {}),
    },
    relay,
    authenticate: async () => {},
    fetch,
    now: () => now,
  });
  return { session, relay, events, requests, fetch, signEvent, nip44 };
}

describe("agent relay session", () => {
  it("creates and activates a relay-managed agent with a one-time controller bundle", async () => {
    const events: NostrEvent[] = [];
    const managedRequests: Array<{ url: string; body: unknown }> = [];
    const profileTemplate: NostrEventTemplate = {
      kind: 0,
      created_at: now,
      tags: [["lapis-managed", owner, relayPubkey]],
      content: '{"name":"Research","about":"Checks evidence"}',
    };
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const url = String(input);
      if (!init?.method)
        return Response.json({
          self: relayPubkey,
          supported_nips: [29, 46],
          lapis_managed_agents: {
            version: 1,
            provisioning_url: "https://relay.example/api/agents/managed",
            bunker_url: "wss://relay.example/nip46",
            relay_pubkey: relayPubkey,
            authorization_type: "lapis-managed-v1",
          },
        });
      const auth = JSON.parse(
        atob(new Headers(init.headers).get("Authorization")!.slice(6)),
      ) as NostrEvent;
      expect(verifyEvent(auth)).toBe(true);
      expect(auth.pubkey).toBe(owner);
      expect(auth.tags).toContainEqual(["u", url]);
      expect(auth.tags).toContainEqual(["method", init.method]);
      if (init.method !== "GET")
        expect(auth.tags).toContainEqual([
          "payload",
          bytesToHex(
            sha256(new TextEncoder().encode((init.body as string) ?? "")),
          ),
        ]);
      if (url.endsWith("/query")) return Response.json([]);
      const body = init.body ? JSON.parse(init.body as string) : undefined;
      managedRequests.push({ url, body });
      if (url.endsWith("/api/agents/managed"))
        return Response.json(
          {
            agent: {
              pubkey: agent,
              owner_pubkey: owner,
              status: "pending",
              connection_state: "pending",
              created_at: new Date(now * 1000).toISOString(),
              expires_at: new Date((now + 86_400) * 1000).toISOString(),
            },
            bunker_url: `bunker://${agent}?relay=wss%3A%2F%2Frelay.example%2Fnip46&secret=invite`,
            profile_template: profileTemplate,
          },
          { status: 201 },
        );
      if (url.endsWith(`/${agent}/activate`))
        return Response.json({ status: "active" });
      throw new Error(`Unexpected request: ${url}`);
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
    const bunker = {
      connect: vi.fn(async () => {}),
      getPublicKey: vi.fn(async () => agent),
      signEvent: vi.fn(async (template: NostrEventTemplate) =>
        finalizeEvent(template, agentKey),
      ),
      close: vi.fn(async () => {}),
    };
    const connectBunker = vi.fn(async () => bunker);
    const session = createCommunityAgentSession({
      scope: { id: "test", name: "Test", relayUrl: relay.url },
      identity: {
        getPublicKey: async () => owner,
        signEvent: async (template) => finalizeEvent(template, ownerKey),
      },
      relay,
      authenticate: async () => {},
      fetch,
      connectBunker,
      now: () => now,
    });
    const bundle = await session.createManagedAgent!({
      personaSlug: "research",
      displayName: "Research",
      description: "Checks evidence",
      systemPrompt: "Cite sources",
      nameMode: "instance",
      instanceName: "Research",
      groupIds: ["general"],
    });
    expect(bundle).toMatchObject({
      schema: "lapis.agent-controller-bootstrap/1",
      relay: { url: "wss://relay.example/", pubkey: relayPubkey },
      agent: { pubkey: agent, ownerPubkey: owner, persona: "research" },
      ownerAuthorization: {
        kind: "lapis-managed-v1",
        relayPubkey,
      },
      requiredLocalChoices: { remainingGroups: ["general"] },
    });
    expect(Object.keys(bundle.environment)).toEqual([
      `LAPIS_AGENT_${agent.slice(0, 12).toUpperCase()}_BUNKER_URL`,
      `LAPIS_AGENT_${agent.slice(0, 12).toUpperCase()}_NIP46_CLIENT_SECRET`,
    ]);
    expect(connectBunker).toHaveBeenCalledTimes(1);
    expect(bunker.close).toHaveBeenCalledTimes(1);
    expect(events.map((event) => event.kind)).toEqual([30175]);
    const activation = managedRequests.find(({ url }) =>
      url.endsWith(`/${agent}/activate`),
    )?.body as { owner_event: NostrEvent; profile_event: NostrEvent };
    expect(activation.owner_event).toMatchObject({
      kind: 30177,
      pubkey: owner,
      tags: [["d", agent]],
    });
    expect(activation.profile_event).toMatchObject({
      kind: 0,
      pubkey: agent,
      tags: [["lapis-managed", owner, relayPubkey]],
    });
    expect(verifyEvent(activation.owner_event)).toBe(true);
    expect(verifyEvent(activation.profile_event)).toBe(true);
  });

  it("publishes exact owner-encrypted controller controls", async () => {
    const fixture = setup();
    const event = await fixture.session.sendControl!(agent, {
      version: 1,
      command: "permission_response",
      requestId: "permission-1",
      decision: "allow_once",
      channelId: "project-x",
    });
    expect(verifyEvent(event)).toBe(true);
    expect(event).toMatchObject({ kind: 24_200, pubkey: owner });
    expect(event.tags).toEqual([
      ["p", agent],
      ["agent", agent],
      ["frame", "control"],
      ["h", "project-x"],
    ]);
    expect(event.content).not.toContain("permission-1");
    expect(fixture.nip44.encrypt).toHaveBeenCalledWith(
      agent,
      JSON.stringify({
        version: 1,
        command: "permission_response",
        requestId: "permission-1",
        decision: "allow_once",
        channelId: "project-x",
      }),
    );
    expect(fixture.events).toContainEqual(event);
  });

  it("publishes bounded activity catch-up controls with exact context routing", async () => {
    const fixture = setup();
    const control = {
      version: 2 as const,
      command: "sync_activity" as const,
      requestId: "sync-1",
      context: {
        kind: "thread" as const,
        channelId: "project-x",
        threadRootId: "root-1",
      },
      cursor: { streamId: "stream-1", offset: 4 },
      highWaterMark: 9,
      channelId: "project-x",
    };
    const event = await fixture.session.sendControl!(agent, control);
    expect(event.tags).toContainEqual(["h", "project-x"]);
    expect(fixture.nip44.encrypt).toHaveBeenCalledWith(
      agent,
      JSON.stringify(control),
    );
    await expect(
      fixture.session.sendControl!(agent, {
        ...control,
        context: {
          kind: "channel",
          channelId: "project-x",
          threadRootId: "unexpected",
        } as never,
      }),
    ).rejects.toThrow(/context or cursor/i);
    await expect(
      fixture.session.sendControl!(agent, {
        ...control,
        context: { kind: "dm", channelId: "project-x" } as never,
      }),
    ).rejects.toThrow(/context or cursor/i);
    await expect(
      fixture.session.sendControl!(agent, {
        ...control,
        scopeKey: "arbitrary-controller-scope",
      } as never),
    ).rejects.toThrow(/unknown fields/i);
  });

  it("fails closed when controller encryption is unavailable", async () => {
    const fixture = setup(undefined, false);
    await expect(
      fixture.session.sendControl!(agent, {
        version: 1,
        command: "cancel_turn",
        scopeKey: "scope",
      }),
    ).rejects.toThrow(/NIP-44/i);
    expect(fixture.relay.publish).not.toHaveBeenCalled();
  });

  it.each(["default", "injected"])(
    "preserves the browser receiver for %s native fetch",
    async (mode) => {
      const fixture = setup();
      const browserFetch = vi.fn(function (
        this: typeof globalThis,
        ...args: Parameters<typeof fetch>
      ) {
        if (this !== globalThis) throw new TypeError("Illegal invocation");
        return fixture.fetch(...args);
      });
      vi.stubGlobal("fetch", browserFetch);
      try {
        const session = createCommunityAgentSession({
          scope: { id: "test", name: "Test", relayUrl: fixture.relay.url },
          identity: {
            getPublicKey: async () => owner,
            signEvent: fixture.signEvent,
          },
          relay: fixture.relay,
          authenticate: async () => {},
          ...(mode === "injected" ? { fetch: globalThis.fetch } : {}),
          now: () => now,
        });
        expect((await session.loadDirectory()).capabilities.directory).toBe(
          true,
        );
        expect(browserFetch).toHaveBeenCalledTimes(5);
      } finally {
        vi.unstubAllGlobals();
      }
    },
  );
  it("probes Buzz agent support with its numeric NIP-11 advertisement", async () => {
    const fixture = setup([
      1, 2, 10, 11, 16, 17, 23, 25, 29, 33, 38, 42, 50, 56,
    ]);
    const directory = await fixture.session.loadDirectory();
    expect(directory.capabilities).toEqual({
      directory: true,
      presence: true,
      activity: true,
    });
    expect(fixture.requests.flat()).toContainEqual({
      kinds: [30177],
      authors: [owner],
      limit: 500,
    });
  });
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
  it("publishes owner-authored discovery records for registered agents", async () => {
    const fixture = setup();
    await expect(fixture.session.registerAgent!(agent)).resolves.toMatchObject({
      kind: 30177,
      pubkey: owner,
      tags: [["d", agent]],
      content: "{}",
    });
    await expect(fixture.session.registerAgent!(owner)).rejects.toThrow(
      "own identity",
    );
    const writes = vi
      .mocked(fixture.relay.publish)
      .mock.calls.map(([event]) => event);
    expect(writes).toHaveLength(1);
    expect(writes[0]?.created_at).toBe(now);
  });
  it("keeps an existing persona link when legacy registration is retried", async () => {
    const fixture = setup();
    const linked = finalizeEvent(
      {
        kind: 30177,
        created_at: now,
        tags: [["d", agent]],
        content:
          '{"persona_id":"research","name":"Ada","name_mode":"instance","parallelism":4}',
      },
      ownerKey,
    );
    fixture.events.push(linked);
    await expect(fixture.session.registerAgent!(agent)).resolves.toEqual(
      linked,
    );
    expect(fixture.relay.publish).not.toHaveBeenCalled();
  });
  it("saves a persona and explicit instance link while preserving unknown fields", async () => {
    const fixture = setup();
    fixture.events.push(
      finalizeEvent(
        {
          kind: 30175,
          created_at: now - 2,
          tags: [["d", "research"]],
          content:
            '{"display_name":"Old","model":"keep","credentials":"remove"}',
        },
        ownerKey,
      ),
      finalizeEvent(
        {
          kind: 30177,
          created_at: now - 1,
          tags: [["d", agent]],
          content: '{"legacy":true,"parallelism":4}',
        },
        ownerKey,
      ),
    );
    await fixture.session.saveAgent!({
      pubkey: agent,
      personaSlug: "research",
      displayName: "Research assistant",
      description: "Reviews sources",
      avatarUrl: "https://example.test/research.png",
      systemPrompt: "Cite evidence",
      nameMode: "instance",
      instanceName: "Ada",
    });
    const writes = vi
      .mocked(fixture.relay.publish)
      .mock.calls.map(([event]) => event);
    expect(writes.map((event) => event.kind)).toEqual([30175, 30177]);
    expect(JSON.parse(writes[0]!.content)).toEqual({
      display_name: "Research assistant",
      model: "keep",
      description: "Reviews sources",
      avatar_url: "https://example.test/research.png",
      system_prompt: "Cite evidence",
    });
    expect(JSON.parse(writes[1]!.content)).toEqual({
      legacy: true,
      parallelism: 4,
      persona_id: "research",
      name_mode: "instance",
      name: "Ada",
      respond_to: "owner-only",
    });
    expect(writes[0]!.created_at).toBeGreaterThan(now - 2);
    expect(writes[1]!.created_at).toBeGreaterThan(writes[0]!.created_at);
  });
  it("edits an unlinked reusable persona without writing an instance", async () => {
    const fixture = setup();
    fixture.events.push(
      finalizeEvent(
        {
          kind: 30175,
          created_at: now - 1,
          tags: [["d", "release-notes"]],
          content: '{"display_name":"Old","provider":"keep","token":"remove"}',
        },
        ownerKey,
      ),
    );
    await fixture.session.savePersona!({
      personaSlug: "release-notes",
      displayName: "Release notes",
      systemPrompt: "Summarize releases",
    });
    const writes = vi
      .mocked(fixture.relay.publish)
      .mock.calls.map(([event]) => event);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      kind: 30175,
      tags: [["d", "release-notes"]],
    });
    expect(JSON.parse(writes[0]!.content)).toEqual({
      display_name: "Release notes",
      provider: "keep",
      system_prompt: "Summarize releases",
    });
  });
  it("does not replace unchanged instance state for a prompt-only persona edit", async () => {
    const fixture = setup();
    const persona = finalizeEvent(
      {
        kind: 30175,
        created_at: now - 1,
        tags: [["d", "research"]],
        content: '{"display_name":"Research","system_prompt":"Old"}',
      },
      ownerKey,
    );
    const instance = finalizeEvent(
      {
        kind: 30177,
        created_at: now - 1,
        tags: [["d", agent]],
        content:
          '{"persona_id":"research","name_mode":"inherited","name":"Research","respond_to":"owner-only","parallelism":10}',
      },
      ownerKey,
    );
    fixture.events.push(persona, instance);
    await fixture.session.saveAgent!({
      pubkey: agent,
      personaSlug: "research",
      displayName: "Research",
      systemPrompt: "New",
      nameMode: "inherited",
      instanceName: "Research",
    });
    const writes = vi
      .mocked(fixture.relay.publish)
      .mock.calls.map(([event]) => event);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ kind: 30175 });
  });
  it("unlinks without copying persona prompt and publishes an address deletion", async () => {
    const fixture = setup();
    fixture.events.push(
      finalizeEvent(
        {
          kind: 30177,
          created_at: now - 1,
          tags: [["d", agent]],
          content:
            '{"persona_id":"research","name_mode":"inherited","name":"Research","parallelism":3}',
        },
        ownerKey,
      ),
    );
    await fixture.session.unlinkAgent!(agent, "Public fallback");
    await fixture.session.deletePersona!("research");
    const writes = vi
      .mocked(fixture.relay.publish)
      .mock.calls.map(([event]) => event);
    expect(JSON.parse(writes[0]!.content)).toEqual({
      name_mode: "instance",
      name: "Public fallback",
      parallelism: 3,
    });
    expect(writes[0]!.content).not.toContain("prompt");
    expect(writes[1]).toMatchObject({
      kind: 5,
      tags: [["a", `30175:${owner}:research`]],
    });
  });
  it("disables unsupported relays without making agent queries", async () => {
    const fixture = setup([1]);
    expect((await fixture.session.loadDirectory()).capabilities.directory).toBe(
      false,
    );
    expect(fixture.requests).toEqual([]);
  });
  // Keep the real 501 signatures: the boundary test is intentionally larger
  // than one HTTP page and can exceed five seconds in the concurrent suite.
  it(
    "paginates a full same-second boundary using before_id",
    { timeout: 20_000 },
    async () => {
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
      expect(
        result.events.filter((event) => event.kind === 30177),
      ).toHaveLength(501);
      expect(
        fixture.requests
          .flat()
          .some((filter) => filter.before_id && filter.until === now),
      ).toBe(true);
      expect(result.partial).toBe(false);
    },
  );
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
