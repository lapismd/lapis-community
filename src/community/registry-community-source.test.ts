import { describe, expect, it, vi } from "vitest";

import { createInMemoryRelayFactory } from "../testing/index.js";
import { createRegistryCommunityDataSource } from "./registry-community-source.js";

describe("RegistryCommunityDataSource", () => {
  it("reuses factory relays for bounded registry reads and closes them", () => {
    const factory = createInMemoryRelayFactory();
    const source = createRegistryCommunityDataSource({ relayFactory: factory });
    const relay = source.relay("memory://registry.test");
    const close = vi.spyOn(relay, "close");

    expect(source.relay("memory://registry.test")).toBe(relay);

    source.close();

    expect(close).toHaveBeenCalledOnce();
  });

  it("retains the standard community session boundary", async () => {
    const factory = createInMemoryRelayFactory();
    const source = createRegistryCommunityDataSource({ relayFactory: factory });
    const session = await source.open({
      id: "registry",
      name: "Registry",
      relayUrl: "memory://registry.test",
      rooms: [
        {
          id: "support",
          groupId: "support",
          name: "Support",
          kind: "forum",
        },
      ],
    });

    await expect(session.snapshot()).resolves.toMatchObject({ events: [] });

    session.close();
    source.close();
    factory.reset();
  });
});
