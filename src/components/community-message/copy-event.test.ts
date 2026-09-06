import { describe, expect, it } from "vitest";

import type { NostrEvent } from "../../protocol/index.js";
import { formatCommunityEventCopy } from "./copy-event.js";

describe("formatCommunityEventCopy", () => {
  it("keeps the message as Markdown and appends pretty-printed event JSON", () => {
    const event: NostrEvent = {
      id: "event-id",
      pubkey: "publisher-pubkey",
      created_at: 1_788_714_000,
      kind: 9,
      tags: [["h", "plugin-releases"]],
      content: "**Spell Check** 0.1.2 is ready for curator review.",
      sig: "event-signature",
    };

    expect(formatCommunityEventCopy(`${event.content}\n`, event)).toBe(
      `**Spell Check** 0.1.2 is ready for curator review.\n\n\`\`\`json\n${JSON.stringify(event, null, 2)}\n\`\`\``,
    );
  });

  it("does not add an empty Markdown paragraph before the event", () => {
    const event: NostrEvent = {
      id: "event-id",
      pubkey: "publisher-pubkey",
      created_at: 1_788_714_000,
      kind: 9,
      tags: [],
      content: "",
      sig: "event-signature",
    };

    expect(formatCommunityEventCopy("", event)).toMatch(/^```json\n\{/u);
  });
});
