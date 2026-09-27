import {
  finalizeEvent,
  generateSecretKey,
  type EventTemplate,
} from "nostr-tools/pure";
import { describe, expect, it } from "vitest";

import type { NostrEvent } from "../../protocol/index.js";
import {
  mergeConversationEventPage,
  mergeConversationEvents,
} from "./conversation-event-merge.js";

const secret = generateSecretKey();
const signed = (content: string, created_at: number): NostrEvent =>
  finalizeEvent(
    {
      kind: 1,
      created_at,
      tags: [],
      content,
    } satisfies EventTemplate,
    secret,
  );

describe("mergeConversationEvents", () => {
  it("verifies and deduplicates a relay page as one ordered collection", () => {
    const first = signed("first", 1);
    const replacement = signed("replacement", 2);
    const second = signed("second", 3);
    const invalid = { ...signed("invalid", 4), sig: "0".repeat(128) };

    const merged = mergeConversationEvents(
      [first],
      [replacement, second, replacement, invalid],
    );

    expect(merged.map(({ id }) => id)).toEqual([
      first.id,
      replacement.id,
      second.id,
    ]);
    expect(Object.isFrozen(merged.at(-1))).toBe(true);
  });

  it("retains the existing collection when a batch has no valid events", () => {
    const current = [signed("current", 1)];
    const invalid = { ...signed("invalid", 2), id: "0".repeat(64) };

    expect(mergeConversationEvents(current, [invalid])).toBe(current);
  });

  it("yields between verification batches without exposing partial pages", async () => {
    const events = Array.from({ length: 5 }, (_, index) =>
      signed(`event-${index}`, index + 1),
    );
    let yields = 0;

    const merged = await mergeConversationEventPage([], events, {
      batchSize: 2,
      yieldTask: async () => {
        yields++;
      },
    });

    expect(yields).toBe(2);
    expect(merged.map(({ id }) => id)).toEqual(events.map(({ id }) => id));
  });
});
