import { describe, expect, it } from "vitest";

import { parseConsoleConfig, registryAuthorities } from "./api.js";

const curator = "a".repeat(64);
const publisher = "b".repeat(64);
const baseConfig = {
  backend: "nostr-buzz",
  buzzRelays: ["wss://buzz.example"],
  catalogUrl: "https://registry.example/catalog.json",
  curatorPubkeys: [curator],
  publisherPubkeys: [publisher],
} as const;

describe("Buzz registry console", () => {
  it("accepts only the stock Buzz configuration surface", () => {
    expect(parseConsoleConfig(baseConfig)).toEqual({
      ...baseConfig,
      buzzRelays: ["wss://buzz.example/"],
    });
    expect(() =>
      parseConsoleConfig({ ...baseConfig, backend: "nostr-relay-quorum" }),
    ).toThrow("nostr-buzz");
    expect(() =>
      parseConsoleConfig({
        ...baseConfig,
        buzzRelays: ["https://buzz.example"],
      }),
    ).toThrow("WS or WSS");
  });

  it("maps the configured trusted keys over the catalog", () => {
    const config = parseConsoleConfig(baseConfig);
    const authorities = registryAuthorities(config, [
      { content: { pluginId: "ai" } as never },
      { content: { pluginId: "search" } as never },
    ]);
    expect(authorities.curatorPubkeys).toEqual(new Set([curator]));
    expect(authorities.publisherPubkeysByPlugin).toEqual(
      new Map([
        ["ai", new Set([publisher])],
        ["search", new Set([publisher])],
      ]),
    );
  });
});
