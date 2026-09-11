import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from "nostr-tools/pure";
import * as nip44 from "nostr-tools/nip44";
import { describe, expect, it, vi } from "vitest";
import { createCommunityAgentSession } from "../community/agent-session.js";
import { createCommunityAgentsController } from "../community/agent-controller.js";
import { createMemoryAgentActivityStore } from "../community/agent-archive.js";
import { createWebSocketCommunityRelayFactory } from "../nostr/index.js";
import { SecretKeyRegistrySigner } from "../auth/index.js";
import { createCommunityStoryRuntime } from "./community-test-runtime.js";

export function registerAgentDockerContract(relayUrl: string): void {
  describe("Buzz agent Community contract against Docker", () => {
    it("discovers owned agents, follows, reads presence, captures encrypted activity and isolates owners", async () => {
      const runtime = await createCommunityStoryRuntime({
        backend: "docker",
        relayUrl,
        namespace: `agent-${crypto.randomUUID()}`,
      });
      const owner = runtime.scenario.operator;
      const ownerPubkey = await owner.getPublicKey();
      const agentKey = generateSecretKey();
      const agentPubkey = getPublicKey(agentKey);
      // The existing deterministic test owner signs a standard NIP-OA credential.
      const proof = bytesToHex(
        schnorr.sign(
          sha256(new TextEncoder().encode(`nostr:agent-auth:${agentPubkey}:`)),
          new Uint8Array(32).fill(21),
        ),
      );
      const now = () => Math.floor(Date.now() / 1000);
      const profile = finalizeEvent(
        {
          kind: 0,
          created_at: now(),
          tags: [["auth", ownerPubkey, "", proof]],
          content: '{"name":"Contract agent"}',
        },
        agentKey,
      );
      const factory = createWebSocketCommunityRelayFactory();
      const ownerRelay = factory.create(relayUrl);
      const agentRelay = factory.create(relayUrl);
      const strangerRelay = factory.create(relayUrl);
      const stranger = new SecretKeyRegistrySigner(generateSecretKey());
      const archive = createMemoryAgentActivityStore();
      const scope = {
        communityId: runtime.scenario.scope.id,
        relayUrls: [relayUrl],
        ownerPubkey,
      };
      let controller:
        | ReturnType<typeof createCommunityAgentsController>
        | undefined;
      try {
        await ownerRelay.authenticate!((template) => owner.signEvent(template));
        await agentRelay.authenticate!((template) =>
          Promise.resolve(
            finalizeEvent(
              {
                ...template,
                tags: [...template.tags, ["auth", ownerPubkey, "", proof]],
              },
              agentKey,
            ),
          ),
        );
        await strangerRelay.authenticate!((template) =>
          stranger.signEvent(template),
        );
        await agentRelay.publish(profile);
        const groupId = runtime.scenario.scope.rooms![0]!.groupId!;
        await ownerRelay.publish(
          await owner.signEvent({
            kind: 9000,
            created_at: now(),
            content: "",
            tags: [
              ["h", groupId],
              ["p", agentPubkey],
            ],
          }),
        );
        const session = createCommunityAgentSession({
          scope: runtime.scenario.scope,
          identity: owner,
          relay: ownerRelay,
          authenticate: async () => undefined,
        });
        await session.saveAgent!({
          pubkey: agentPubkey,
          personaSlug: "contract-agent",
          displayName: "Contract persona",
          description: "Docker-backed persona",
          avatarUrl: "https://example.test/contract-agent.png",
          systemPrompt: "Exercise the Community contract.",
          nameMode: "inherited",
        });
        await vi.waitFor(
          async () => {
            const directory = await session.loadDirectory();
            expect(directory.capabilities.activity).toBe(true);
            const managed = directory.agents.find(
              (agent) => agent.pubkey === agentPubkey,
            );
            expect(managed?.channelIds).toContain(groupId);
            expect(managed).toMatchObject({
              name: "Contract persona",
              avatarUrl: "https://example.test/contract-agent.png",
              personaStatus: "linked",
              persona: {
                slug: "contract-agent",
                systemPrompt: "Exercise the Community contract.",
              },
              instance: { nameMode: "inherited" },
            });
          },
          { timeout: 10000, interval: 250 },
        );
        await session.savePersona!({
          personaSlug: "contract-agent",
          displayName: "Contract editor",
          description: "Updated without rewriting the agent instance",
          avatarUrl: "https://example.test/contract-editor.png",
          systemPrompt: "Keep contract answers concise.",
        });
        await vi.waitFor(
          async () => {
            const directory = await session.loadDirectory();
            expect(directory.personas).toContainEqual(
              expect.objectContaining({
                slug: "contract-agent",
                displayName: "Contract editor",
                systemPrompt: "Keep contract answers concise.",
              }),
            );
            expect(
              directory.agents.find((agent) => agent.pubkey === agentPubkey),
            ).toMatchObject({
              name: "Contract editor",
              avatarUrl: "https://example.test/contract-editor.png",
              instance: {
                personaId: "contract-agent",
                nameMode: "inherited",
              },
            });
          },
          { timeout: 10000, interval: 250 },
        );
        await session.setFollow(agentPubkey, true);
        expect(
          (await session.loadDirectory()).agents.find(
            (agent) => agent.pubkey === agentPubkey,
          )?.followed,
        ).toBe(true);
        await session.setFollow(agentPubkey, false);
        await agentRelay.publish(
          finalizeEvent(
            { kind: 20001, created_at: now(), content: "", tags: [] },
            agentKey,
          ),
        );
        expect((await session.loadPresence([agentPubkey]))[0]?.kind).toBe(
          20001,
        );
        controller = createCommunityAgentsController({
          scope,
          identity: owner,
          session,
          archive,
          storageMode: () => "memory",
          onState() {},
        });
        await controller.start();
        const event = finalizeEvent(
          {
            kind: 24200,
            created_at: now(),
            tags: [
              ["p", ownerPubkey],
              ["agent", agentPubkey],
              ["frame", "telemetry"],
              ["h", groupId],
            ],
            content: nip44.v2.encrypt(
              JSON.stringify({
                seq: 1,
                timestamp: new Date().toISOString(),
                kind: "turn_started",
                channelId: groupId,
                payload: { text: "private contract activity" },
              }),
              nip44.v2.utils.getConversationKey(agentKey, ownerPubkey),
            ),
          },
          agentKey,
        );
        const leaked: string[] = [];
        const strangerSub = await strangerRelay.subscribe(
          { kinds: [24200], "#p": [ownerPubkey] },
          { onevent: (frame) => leaked.push(frame.id) },
        );
        await agentRelay.publish(event);
        await vi.waitFor(
          async () =>
            expect((await archive.page({ scope })).records).toHaveLength(1),
          { timeout: 10000 },
        );
        expect(controller.state.activity).toEqual([]);
        await controller.actions.openActivity(agentPubkey);
        expect(controller.state.activity[0]?.frame.payload).toEqual({
          text: "private contract activity",
        });
        expect(leaked).toEqual([]);
        expect(
          await ownerRelay.query({ kinds: [24200], "#p": [ownerPubkey] }),
        ).toEqual([]);
        strangerSub.close();
        await controller.actions.clearHistory();
        expect((await archive.page({ scope })).records).toEqual([]);
      } finally {
        controller?.dispose();
        ownerRelay.close();
        agentRelay.close();
        strangerRelay.close();
        runtime.dispose();
      }
    }, 45000);
  });
}
