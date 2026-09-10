import { describe, it, expect, vi } from "vitest";
import { getPublicKey, finalizeEvent } from "nostr-tools/pure";
import * as nip44 from "nostr-tools/nip44";
import { createCommunityTestRuntime } from "../testing/community-test-runtime.js";
import {
  storyAgentKey,
  storyAgentPubkey,
  storyOwnerPubkey,
  storyAgentProfile,
} from "../components/community-agents/story-fixtures.js";
import { createCommunityController } from "./community-controller.svelte.js";
import { createNip29CommunitySource } from "./nip29-community-source.js";
import type { RelayFilter } from "../nostr/index.js";

describe("production Community agent integration", () => {
  it("discovers memberships and captures telemetry before a panel opens", async () => {
    const now = Math.floor(Date.now() / 1000);
    const runtime = await createCommunityTestRuntime({
      createdAt: now - 100,
      relayUrl: "wss://agent-community.example/",
    });
    const { relay, scenario } = runtime;
    relay.inject(storyAgentProfile);
    await relay.publish(
      await scenario.operator.signEvent({
        kind: 30177,
        created_at: now,
        content: "",
        tags: [["d", storyAgentPubkey]],
      }),
    );
    await relay.publish(
      await scenario.operator.signEvent({
        kind: 9000,
        created_at: now,
        content: "",
        tags: [
          ["h", "general"],
          ["p", storyAgentPubkey],
        ],
      }),
    );
    const bridge: typeof fetch = async (_input, init) =>
      !init?.body
        ? Response.json({
            self: getPublicKey(new Uint8Array(32).fill(23)),
            supported_nips: [29, 44, "OA", "AO"],
          })
        : Response.json(
            (
              await Promise.all(
                (JSON.parse(String(init.body)) as RelayFilter[])
                  .filter((filter) => !filter.kinds?.includes(40902))
                  .map((filter) => relay.query(filter)),
              )
            ).flat(),
          );
    const controller = createCommunityController({
      scopes: [scenario.scope],
      identity: scenario.operator,
      source: createNip29CommunitySource({
        relayFactory: runtime.relayFactory,
        fetch: bridge,
      }),
    });
    controller.initialize();
    try {
      await vi.waitFor(() =>
        expect(controller.state.agents?.status).toBe("ready"),
      );
      expect(controller.state.agents?.agents[0]?.channelIds).toContain(
        "general",
      );
      await relay.publish(
        finalizeEvent(
          {
            kind: 24200,
            created_at: now,
            tags: [
              ["p", storyOwnerPubkey],
              ["agent", storyAgentPubkey],
              ["frame", "telemetry"],
              ["h", "general"],
            ],
            content: nip44.v2.encrypt(
              JSON.stringify({
                seq: 1,
                timestamp: new Date().toISOString(),
                kind: "turn_started",
                channelId: "general",
                payload: { text: "Private activity" },
              }),
              nip44.v2.utils.getConversationKey(
                storyAgentKey,
                storyOwnerPubkey,
              ),
            ),
          },
          storyAgentKey,
        ),
      );
      await vi.waitFor(() =>
        expect(controller.state.agents?.working[storyAgentPubkey]).toBe(true),
      );
      expect(controller.state.agents?.activity).toEqual([]);
      await controller.actions.agents!.openActivity(storyAgentPubkey);
      expect(controller.state.agents?.activity[0]?.frame.payload).toEqual({
        text: "Private activity",
      });
    } finally {
      controller.dispose();
      runtime.dispose();
    }
  });
});
