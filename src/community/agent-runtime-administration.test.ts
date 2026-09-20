import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
import * as nip44 from "nostr-tools/nip44";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NostrEvent } from "../protocol/index.js";
import {
  createCommunityAgentsController,
  type CommunityAgentsController,
} from "./agent-controller.js";
import { materializeAgentDirectory } from "./agent-protocol.js";
import type { CommunityAgentSession } from "./agent-contracts.js";
import { lateRuntimeState } from "./agent-administration-state.js";
import { editorRuntimeDraft } from "./agent-editor-runtime.js";
import { parseRuntimeState } from "./agent-state-parsers.js";

const ownerKey = new Uint8Array(32).fill(71);
const agentKey = new Uint8Array(32).fill(72);
const relayKey = new Uint8Array(32).fill(73);
const owner = getPublicKey(ownerKey);
const agent = getPublicKey(agentKey);
const relay = getPublicKey(relayKey);
const now = 1_800_000_100;
const conversation = nip44.v2.utils.getConversationKey(agentKey, owner);
const profile = finalizeEvent(
  {
    kind: 0,
    created_at: now,
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
    content: '{"name":"Research"}',
  },
  agentKey,
);
const catalog = {
  agent: "codex",
  currentModel: "gpt-6",
  models: ["gpt-6"],
  configOptions: [],
};
let controllers: CommunityAgentsController[] = [];
afterEach(() => {
  controllers.forEach((controller) => controller.dispose());
  controllers = [];
});

function runtimeFrame(
  requestId: string,
  runtimeAgents: readonly Record<string, unknown>[],
): NostrEvent {
  return finalizeEvent(
    {
      kind: 24200,
      created_at: now,
      tags: [
        ["p", owner],
        ["agent", agent],
        ["frame", "telemetry"],
      ],
      content: nip44.v2.encrypt(
        JSON.stringify({
          version: 2,
          seq: 0,
          timestamp: new Date(now * 1000).toISOString(),
          kind: "runtime_state",
          payload: {
            requestId,
            agentId: "agent-research",
            host: { id: "workspace", kind: "managed" },
            runtimeAgents,
            configured: { runtimeAgent: "codex", model: "gpt-6" },
            saved: null,
            effective: { runtimeAgent: "codex", model: "gpt-6" },
            catalog,
            tools: [],
            memory: { enabled: false, candidates: 0 },
          },
        }),
        conversation,
      ),
    },
    agentKey,
  );
}

describe("late runtime administration", () => {
  it("treats a listed harness without a catalog as still loading", () => {
    const pending = {
      agentId: "agent-research",
      host: { id: "workspace", kind: "managed" },
      runtimeAgents: [
        { id: "codex", label: "Codex", catalog },
        { id: "cursor", label: "Cursor" },
      ],
      configured: { runtimeAgent: "codex", model: "gpt-6" },
      effective: { runtimeAgent: "codex", model: "gpt-6" },
      catalog,
      tools: [],
      memory: { enabled: false, candidates: 0 },
    };
    const draft = editorRuntimeDraft(pending, "cursor", {});
    expect(draft.catalog).toEqual({
      agent: "cursor",
      models: [],
      configOptions: [],
    });
    expect(draft.modelTriggerLabel).toBe("Loading models…");
    expect(draft.modelOptions).toEqual([]);
  });

  it("labels an unavailable harness catalog as empty", () => {
    const draft = editorRuntimeDraft(
      {
        agentId: "agent-research",
        host: { id: "workspace", kind: "managed" },
        runtimeAgents: [{ id: "codex", label: "Codex", catalog }],
        configured: { runtimeAgent: "codex", model: "gpt-6" },
        effective: { runtimeAgent: "codex", model: "gpt-6" },
        catalog,
        tools: [],
        memory: { enabled: false, candidates: 0 },
      },
      "cursor",
      {},
    );
    expect(draft.modelTriggerLabel).toBe("No models for this harness");
    expect(draft.modelOptions).toEqual([]);
  });

  it("merges a later runtime_state onto the current profile", () => {
    const first = parseRuntimeState({
      agentId: "agent-research",
      host: { id: "workspace", kind: "managed" },
      runtimeAgents: [{ id: "codex", label: "Codex", catalog }],
      configured: { runtimeAgent: "codex", model: "gpt-6" },
      effective: { runtimeAgent: "codex", model: "gpt-6" },
      catalog,
      tools: [],
      memory: { enabled: false, candidates: 0 },
    });
    expect(
      lateRuntimeState({ [agent]: first! }, agent, "runtime_state", {
        agentId: "agent-research",
        host: { id: "workspace", kind: "managed" },
        runtimeAgents: [
          { id: "codex", label: "Codex", catalog },
          {
            id: "cursor",
            label: "Cursor",
            catalog: {
              agent: "cursor",
              currentModel: "composer-2.5",
              models: ["composer-2.5"],
              configOptions: [],
            },
          },
        ],
        configured: { runtimeAgent: "codex", model: "gpt-6" },
        effective: { runtimeAgent: "codex", model: "gpt-6" },
        catalog,
        tools: [],
        memory: { enabled: false, candidates: 0 },
      })?.[agent]?.runtimeAgents.map((entry) => [
        entry.id,
        entry.catalog?.currentModel,
      ]),
    ).toEqual([
      ["codex", "gpt-6"],
      ["cursor", "composer-2.5"],
    ]);
  });

  it("updates the profile from a later unmatched runtime_state", async () => {
    let receive: (event: NostrEvent) => void = () => {};
    const session: CommunityAgentSession = {
      loadDirectory: async () => ({
        agents: materializeAgentDirectory([profile], owner, relay),
        personas: [],
        events: [profile],
        relayPubkey: relay,
        capabilities: { directory: true, presence: true, activity: true },
        partial: false,
      }),
      loadPresence: async () => [],
      subscribe: async (_keys, handlers) => {
        receive = handlers.onevent;
        return { close() {} };
      },
      setFollow: async () => profile,
      registerAgent: async () => profile,
      savePersona: async () => profile,
      saveAgent: async () => ({ persona: profile }),
      unlinkAgent: async () => profile,
      deletePersona: async () => profile,
      sendControl: vi.fn(async () => profile),
    };
    const controller = createCommunityAgentsController({
      scope: {
        communityId: "test",
        relayUrls: ["wss://relay.example/"],
        ownerPubkey: owner,
      },
      identity: {
        getPublicKey: async () => owner,
        signEvent: async () => profile,
        nip44: {
          decrypt: async (_key, ciphertext) =>
            nip44.v2.decrypt(ciphertext, conversation),
          encrypt: async () => "",
        },
      },
      session,
      storageMode: () => "indexeddb",
      onState: () => {},
      now: () => now,
    });
    controllers.push(controller);
    await controller.start();
    const pending = controller.actions.loadRuntime(agent);
    await vi.waitFor(() =>
      expect(session.sendControl).toHaveBeenCalledWith(
        agent,
        expect.objectContaining({ command: "runtime_get" }),
        expect.any(AbortSignal),
      ),
    );
    const control = vi.mocked(session.sendControl!).mock.calls.at(-1)![1];
    const requestId = "requestId" in control ? control.requestId : "";
    receive(
      runtimeFrame(requestId, [
        { id: "codex", label: "Codex", catalog },
        { id: "cursor", label: "Cursor" },
      ]),
    );
    await pending;
    receive(
      runtimeFrame(requestId, [
        { id: "codex", label: "Codex", catalog },
        {
          id: "cursor",
          label: "Cursor",
          catalog: {
            agent: "cursor",
            currentModel: "composer-2.5",
            models: ["composer-2.5"],
            configOptions: [],
          },
        },
      ]),
    );
    await vi.waitFor(() =>
      expect(
        controller.state.runtime?.[agent]?.runtimeAgents.find(
          (entry) => entry.id === "cursor",
        )?.catalog?.models,
      ).toEqual(["composer-2.5"]),
    );
  });
});
