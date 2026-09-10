import { describe, expect, it } from "vitest";

import {
  DEFAULT_COMMUNITY_DEV_RELAY_URL,
  resolveCommunityDevRelayConfiguration,
} from "./config.js";

describe("community dev relay configuration", () => {
  it("uses one canonical relay for Community, Registry, and Projects", () => {
    const environment = {
      VITE_COMMUNITY_LIVE_RELAY_URL: "  wss://community.example.test  ",
      VITE_REGISTRY_RELAYS: "wss://stale-registry.example.test",
    };

    expect(resolveCommunityDevRelayConfiguration(environment)).toEqual({
      relayUrl: "wss://community.example.test",
      registryRelays: ["wss://community.example.test"],
    });
  });

  it("falls back to the local relay when no endpoint is configured", () => {
    expect(resolveCommunityDevRelayConfiguration({})).toEqual({
      relayUrl: DEFAULT_COMMUNITY_DEV_RELAY_URL,
      registryRelays: [DEFAULT_COMMUNITY_DEV_RELAY_URL],
    });
  });
});
