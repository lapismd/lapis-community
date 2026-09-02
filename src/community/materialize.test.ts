import { finalizeEvent } from "nostr-tools/pure";
import { describe, expect, it } from "vitest";

import {
  Nip29MemoryPolicy,
  createCommunityTestScenario,
  createInMemoryRelayFactory,
} from "../testing/index.js";
import { materializeCommunityWorkspace } from "./materialize.js";
import { materializeCommunitySettings } from "./materialize-settings.js";
import { createNip29CommunitySource } from "./nip29-community-source.js";

describe("materializeCommunityWorkspace", () => {
  it("is deterministic across event order, duplicates, and replay", async () => {
    const scenario = createCommunityTestScenario();
    const relayFactory = createInMemoryRelayFactory({
      policy: new Nip29MemoryPolicy({
        relaySecretKey: new Uint8Array(32).fill(51),
        now: () => 1_700_000_000,
      }),
    });
    await scenario.seed(relayFactory.relay(scenario.scope.relayUrl));
    const session = await createNip29CommunitySource({ relayFactory }).open(
      scenario.scope,
      { identity: scenario.operator },
    );
    const snapshot = await session.snapshot();
    const forward = materializeCommunityWorkspace(
      [scenario.scope],
      { [scenario.scope.id]: snapshot.events },
      scenario.scope.id,
      { activeRoomId: "general" },
    );
    const replayed = materializeCommunityWorkspace(
      [scenario.scope],
      {
        [scenario.scope.id]: [
          ...snapshot.events.toReversed(),
          ...snapshot.events,
        ],
      },
      scenario.scope.id,
      { activeRoomId: "general" },
    );
    expect(replayed).toEqual(forward);
    session.close();
  });
});

describe("materializeCommunitySettings", () => {
  it("does not mutate events while verifying profile metadata", () => {
    const event = Object.freeze(
      structuredClone(
        finalizeEvent(
          {
            kind: 0,
            created_at: 1_700_000_000,
            content: JSON.stringify({ display_name: "Reader" }),
            tags: [],
          },
          new Uint8Array(32).fill(52),
        ),
      ),
    );

    expect(materializeCommunitySettings([event], event.pubkey).profile).toEqual(
      expect.objectContaining({ displayName: "Reader" }),
    );
  });
});
