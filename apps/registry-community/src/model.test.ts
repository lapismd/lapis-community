import { describe, expect, it } from "vitest";

import { anyRelayPublished, parseRelayUrls } from "./model.js";

describe("registry community model", () => {
  it("accepts unique WebSocket relay URLs and rejects other input", () => {
    expect(
      parseRelayUrls(
        JSON.stringify([
          "ws://localhost:8381",
          "ws://localhost:8381/",
          "wss://relay.example/nostr",
          "https://relay.example",
          42,
        ]),
      ),
    ).toEqual(["ws://localhost:8381/", "wss://relay.example/nostr"]);
    expect(parseRelayUrls("not json")).toEqual([]);
  });

  it("requires at least one relay acknowledgement", () => {
    expect(
      anyRelayPublished([
        { status: "rejected", reason: new Error("offline") },
        { status: "fulfilled", value: undefined },
      ]),
    ).toBe(true);
    expect(
      anyRelayPublished([{ status: "rejected", reason: new Error("offline") }]),
    ).toBe(false);
  });
});
