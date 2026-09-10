import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
import * as nip44 from "nostr-tools/nip44";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NostrEvent } from "../protocol/index.js";
import { createMemoryAgentActivityStore } from "./agent-archive.js";
import {
  createCommunityAgentsController,
  type CommunityAgentsController,
} from "./agent-controller.js";
import { materializeAgentDirectory } from "./agent-protocol.js";
import type {
  CommunityAgentDirectory,
  CommunityAgentSession,
} from "./agent-contracts.js";

const ownerKey = new Uint8Array(32).fill(61);
const agentKey = new Uint8Array(32).fill(62);
const relayKey = new Uint8Array(32).fill(63);
const owner = getPublicKey(ownerKey);
const agent = getPublicKey(agentKey);
const relay = getPublicKey(relayKey);
const now = 1_800_000_000;
const proof = bytesToHex(
  schnorr.sign(
    sha256(new TextEncoder().encode(`nostr:agent-auth:${agent}:`)),
    ownerKey,
  ),
);
const profile = finalizeEvent(
  {
    kind: 0,
    created_at: now,
    tags: [["auth", owner, "", proof]],
    content: '{"name":"Research"}',
  },
  agentKey,
);
const channel = finalizeEvent(
  {
    kind: 39002,
    created_at: now,
    tags: [
      ["d", "general"],
      ["p", owner],
      ["p", agent],
    ],
    content: "",
  },
  relayKey,
);
const scope = {
  communityId: "test",
  relayUrls: ["wss://relay.example/"],
  ownerPubkey: owner,
};
const conversation = nip44.v2.utils.getConversationKey(agentKey, owner);
let controllers: CommunityAgentsController[] = [];
afterEach(() => {
  controllers.forEach((controller) => controller.dispose());
  controllers = [];
});

function frame(seq = 1, kind = "turn_started", h = "general") {
  return finalizeEvent(
    {
      kind: 24200,
      created_at: now,
      tags: [
        ["p", owner],
        ["agent", agent],
        ["frame", "telemetry"],
        ["h", h],
      ],
      content: nip44.v2.encrypt(
        JSON.stringify({
          seq,
          timestamp: new Date(now * 1000).toISOString(),
          kind,
          channelId: h,
          sessionId: "s",
          turnId: "t",
          payload: { text: "private result" },
        }),
        conversation,
      ),
    },
    agentKey,
  );
}

async function setup() {
  const archive = createMemoryAgentActivityStore();
  const onState = vi.fn();
  let receive: (event: NostrEvent) => void = () => {};
  const directory: CommunityAgentDirectory = {
    agents: materializeAgentDirectory([profile, channel], owner, relay),
    events: [profile, channel],
    relayPubkey: relay,
    capabilities: { directory: true, presence: true, activity: true },
    partial: false,
  };
  const session: CommunityAgentSession = {
    loadDirectory: vi.fn(async () => directory),
    loadPresence: async () => [],
    subscribe: async (_keys, handlers) => {
      receive = handlers.onevent;
      return { close() {} };
    },
    setFollow: async () => profile,
  };
  const decrypt = vi.fn(async (_key: string, ciphertext: string) =>
    nip44.v2.decrypt(ciphertext, conversation),
  );
  const identity = {
    getPublicKey: async () => owner,
    signEvent: async () => profile,
    nip44: { decrypt, encrypt: async () => "" },
  };
  const controller = createCommunityAgentsController({
    scope,
    identity,
    session,
    archive,
    storageMode: () => "indexeddb",
    onState,
    now: () => now,
  });
  controllers.push(controller);
  await controller.start();
  return { controller, archive, receive, decrypt, onState, session };
}

describe("agent activity controller", () => {
  it("captures encrypted activity while the panel is closed and restores it on demand", async () => {
    const { controller, archive, receive } = await setup();
    const event = frame();
    receive(event);
    receive(event);
    await vi.waitFor(async () =>
      expect((await archive.page({ scope })).records).toHaveLength(1),
    );
    expect(controller.state.activity).toEqual([]);
    await vi.waitFor(() => expect(controller.state.working[agent]).toBe(true));
    await controller.actions.openActivity(agent);
    expect(controller.state.activity[0]?.frame.payload).toEqual({
      text: "private result",
    });
    expect(controller.state.activity).toHaveLength(1);
  });
  it("clears working on Buzz turn_finished and ignores an out-of-order start", async () => {
    const { controller, receive } = await setup();
    receive(frame(2, "turn_finished"));
    receive(frame(1, "turn_started"));
    await controller.actions.openActivity(agent);
    await vi.waitFor(() => expect(controller.state.activity).toHaveLength(2));
    expect(controller.state.working[agent]).toBe(false);
    receive(frame(3, "turn_started"));
    await vi.waitFor(() => expect(controller.state.working[agent]).toBe(true));
    receive(frame(4, "turn_finished"));
    await vi.waitFor(() => expect(controller.state.working[agent]).toBe(false));
  });
  it("does not infer current working state from historical activity", async () => {
    const { controller, archive } = await setup();
    await archive.append(scope, [{ event: frame(), profile, receivedAt: now }]);
    await controller.actions.openActivity(agent);
    expect(controller.state.activity).toHaveLength(1);
    expect(controller.state.working[agent]).not.toBe(true);
  });
  it("drops stranger telemetry, malformed payloads and inaccessible channel frames", async () => {
    const { controller, archive, receive } = await setup();
    receive(frame(1, "turn_started", "private"));
    const stranger = finalizeEvent(frame(2), relayKey);
    receive(stranger);
    const invalid = finalizeEvent(
      { ...frame(3), content: nip44.v2.encrypt("{}", conversation) },
      agentKey,
    );
    receive(invalid);
    await vi.waitFor(async () =>
      expect((await archive.page({ scope })).records).toHaveLength(1),
    );
    await controller.actions.openActivity(agent);
    expect(controller.state.activity).toEqual([]);
  });
  it("does not capture scoped telemetry when only the agent belongs to a public channel", async () => {
    const { controller, session, receive, archive } = await setup();
    const publicMembership = finalizeEvent(
      {
        ...channel,
        created_at: now + 1,
        tags: [
          ["d", "general"],
          ["p", agent],
        ],
      },
      relayKey,
    );
    vi.mocked(session.loadDirectory).mockResolvedValue({
      agents: materializeAgentDirectory(
        [profile, publicMembership],
        owner,
        relay,
      ),
      events: [profile, publicMembership],
      relayPubkey: relay,
      capabilities: { directory: true, presence: true, activity: true },
      partial: false,
    });
    await controller.actions.refresh();
    expect(controller.state.agents[0]?.channelIds).toEqual(["general"]);
    receive(frame());
    await controller.actions.openActivity(agent);
    expect((await archive.page({ scope })).records).toEqual([]);
  });
  it("stops publishing decoded results when the owning controller is disposed", async () => {
    const { controller, receive, decrypt, onState } = await setup();
    let resolve!: (value: string) => void;
    decrypt.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    receive(frame());
    await vi.waitFor(() => expect(decrypt).toHaveBeenCalled());
    controller.dispose();
    const count = onState.mock.calls.length;
    resolve(
      JSON.stringify({
        seq: 1,
        timestamp: new Date(now * 1000).toISOString(),
        kind: "turn_started",
        payload: {},
      }),
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(onState).toHaveBeenCalledTimes(count);
    expect(controller.state.activity).toEqual([]);
    expect(controller.state.working).toEqual({});
  });
  it("keeps encrypted history when decryption is declined and supports retry", async () => {
    const { controller, archive, receive, decrypt } = await setup();
    decrypt.mockRejectedValueOnce(new Error("declined"));
    receive(frame());
    await vi.waitFor(() =>
      expect(controller.state.activityError).toContain("declined"),
    );
    expect((await archive.page({ scope })).records).toHaveLength(1);
    await controller.actions.openActivity(agent);
    expect(controller.state.activityError).toBeUndefined();
    expect(controller.state.activity).toHaveLength(1);
  });
  it("reports quota failures, retains old history, and permits clearing to free storage", async () => {
    const { controller, archive, receive } = await setup();
    await archive.append(scope, [
      { event: frame(1), profile, receivedAt: now },
    ]);
    vi.spyOn(archive, "append").mockRejectedValueOnce(
      new Error("QuotaExceededError"),
    );
    receive(frame(2));
    await vi.waitFor(() =>
      expect(controller.state.archiveError).toContain("could not be saved"),
    );
    expect((await archive.page({ scope })).records).toHaveLength(1);
    await controller.actions.clearHistory(agent);
    expect((await archive.page({ scope })).records).toEqual([]);
    expect(controller.state.archiveError).toBeUndefined();
  });
});
