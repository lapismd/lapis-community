import type {
  RegistryRelay,
  RelayFilter,
  RelayPublishResult,
} from "@lapismd/registry-nostr";
import type { NostrEvent } from "@lapismd/registry-protocol";
import { describe, expect, it } from "vitest";

import { publishWithRetainedQuorum } from "./publication.js";

const event = {
  id: "a".repeat(64),
  pubkey: "b".repeat(64),
  created_at: 1,
  kind: 1,
  tags: [],
  content: "",
  sig: "c".repeat(128),
} satisfies NostrEvent;

class TestRelay implements RegistryRelay {
  readonly retained: NostrEvent[] = [];

  constructor(
    readonly url: string,
    private readonly publishAction: "accept" | "retain-then-error" | "error",
  ) {}

  async publish(value: NostrEvent): Promise<RelayPublishResult> {
    if (this.publishAction !== "error") this.retained.push(value);
    if (this.publishAction !== "accept") throw new Error("connection closed");
    return { accepted: true, message: "saved" };
  }

  async query(filter: RelayFilter): Promise<NostrEvent[]> {
    const ids = new Set(filter.ids ?? []);
    return this.retained.filter((value) => ids.has(value.id));
  }

  close(): void {}
}

describe("local fixture retained publication quorum", () => {
  it("counts an event that a relay retained before losing its acknowledgement", async () => {
    const result = await publishWithRetainedQuorum(
      event,
      [
        new TestRelay("ws://a", "accept"),
        new TestRelay("ws://b", "retain-then-error"),
        new TestRelay("ws://c", "error"),
      ],
      2,
    );

    expect(result.retained).toBe(2);
    expect(result.attempts.map((attempt) => attempt.accepted)).toEqual([
      true,
      true,
      false,
    ]);
  });

  it("fails closed when fewer than the required relays retain the event", async () => {
    await expect(
      publishWithRetainedQuorum(
        event,
        [
          new TestRelay("ws://a", "retain-then-error"),
          new TestRelay("ws://b", "error"),
          new TestRelay("ws://c", "error"),
        ],
        2,
      ),
    ).rejects.toThrow("1/2");
  });
});
