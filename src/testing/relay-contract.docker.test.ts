import { finalizeEvent } from "nostr-tools/pure";
import { describe, it } from "vitest";

import {
  createWebSocketCommunityRelayFactory,
  type CommunityRelay,
} from "../nostr/index.js";
import {
  registerCommunityRelayContract,
  relayContractAliceKey,
} from "./relay-contract-suite.js";

const relayUrl = process.env.COMMUNITY_RELAY_URL;

if (relayUrl === undefined || relayUrl === "") {
  describe.skip("WebSocketCommunityRelay Docker contract", () => {
    it("requires COMMUNITY_RELAY_URL", () => undefined);
  });
} else {
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
}
