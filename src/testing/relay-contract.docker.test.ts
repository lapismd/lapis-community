import { registerAgentDockerContract } from "./agent-contract.docker.js";
import { finalizeEvent } from "nostr-tools/pure";
import { describe, expect, it, vi } from "vitest";

import {
  createWebSocketCommunityRelayFactory,
  type CommunityRelay,
} from "../nostr/index.js";
import {
  registerCommunityRelayContract,
  relayContractAliceKey,
} from "./relay-contract-suite.js";
import { createCommunityStoryRuntime } from "./index.js";

const relayUrl = process.env.COMMUNITY_RELAY_URL;

if (relayUrl === undefined || relayUrl === "") {
  describe.skip("WebSocketCommunityRelay Docker contract", () => {
    it("requires COMMUNITY_RELAY_URL", () => undefined);
  });
} else {
  registerAgentDockerContract(relayUrl);
  registerCommunityRelayContract(
    "WebSocketCommunityRelay Docker contract",
    () => {
      const suffix = crypto.randomUUID();
      const factory = createWebSocketCommunityRelayFactory({
        connectTimeoutMs: 10_000,
        eoseTimeoutMs: 10_000,
        publishTimeoutMs: 10_000,
      });
      const connections = new Set<CommunityRelay>();
      return {
        async connection(secretKey = relayContractAliceKey) {
          const relay = factory.create(relayUrl);
          connections.add(relay);
          await relay.authenticate?.((template) =>
            Promise.resolve(finalizeEvent(template, secretKey)),
          );
          return relay;
        },
        uniqueId(label: string) {
          return `${label}-${suffix}`;
        },
        dispose() {
          for (const relay of connections) relay.close();
          connections.clear();
        },
      };
    },
  );

  describe("production Community controller Docker projection", () => {
    it("projects relay-authoritative writer policy edits", async () => {
      const runtime = await createCommunityStoryRuntime({
        backend: "docker",
        relayUrl,
        namespace: `writer-policy-${crypto.randomUUID()}`,
      });
      runtime.controller.initialize();
      try {
        await vi.waitFor(
          () => expect(runtime.controller.state.status).toBe("connected"),
          { timeout: 10_000 },
        );
        await runtime.controller.actions.updateRoom("general", {
          name: "general",
          description: "Community chat",
          visibility: "private",
          lifecycle: "ongoing",
          postingPolicy: "writers",
        });
        const relay = runtime.relayFactory.create(relayUrl);
        try {
          await relay.authenticate?.((template) =>
            Promise.resolve(finalizeEvent(template, relayContractAliceKey)),
          );
          await expect(
            relay.query({
              kinds: [39_000],
              "#d": [runtime.scenario.scope.rooms?.[0]?.groupId ?? ""],
            }),
          ).resolves.toEqual([
            expect.objectContaining({
              tags: expect.arrayContaining([["write-restricted"]]),
            }),
          ]);
        } finally {
          relay.close();
        }
        await vi.waitFor(
          () => {
            const workspace = runtime.controller.state.workspace;
            expect(
              workspace.navigationSections
                .flatMap((section) => section.rooms)
                .find((room) => room.id === workspace.activeRoomId)
                ?.postingPolicy,
            ).toBe("writers");
          },
          { timeout: 10_000 },
        );
      } finally {
        runtime.dispose();
      }
    });
  });
}
