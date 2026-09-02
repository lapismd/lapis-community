import { createWebSocketCommunityRelayFactory } from "../src/nostr/index.js";
import {
  createCommunityTestScenario,
  seedCommunityTestScenario,
} from "../src/testing/index.js";

const relayUrl = process.env.COMMUNITY_RELAY_URL;
if (relayUrl === undefined || relayUrl === "") {
  throw new Error("COMMUNITY_RELAY_URL is required");
}

const scenario = createCommunityTestScenario({
  relayUrl,
  namespace: process.env.COMMUNITY_SCENARIO_NAMESPACE ?? crypto.randomUUID(),
});
await seedCommunityTestScenario(
  scenario,
  createWebSocketCommunityRelayFactory({
    connectTimeoutMs: 10_000,
    eoseTimeoutMs: 10_000,
    publishTimeoutMs: 10_000,
  }),
);

console.log(`Seeded signed community scenario at ${relayUrl}`);
