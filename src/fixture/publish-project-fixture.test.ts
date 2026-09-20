import { expect, it } from "vitest";
import { verifyEvent } from "nostr-tools/pure";
import { publishProjectFixture } from "./publish-project-fixture.js";
import { commitComments } from "../projects/commit-comments.js";
import { buildRepositoryAgentContexts } from "../projects/repository-agent-context.js";

it("seeds native messages and visible thinking linked to a complete agent checkpoint", async () => {
  const events = await publishProjectFixture(
    {
      operatorSecret: new Uint8Array(32).fill(1),
      contributorSecret: new Uint8Array(32).fill(2),
      agentSecret: new Uint8Array(32).fill(3),
      channelId: "test",
      relatedChannelId: "related",
      relayUrl: "wss://relay.example.test",
      createdAt: 1_800_000_000,
    },
    async () => {},
  );
  expect(events.every(verifyEvent)).toBe(true);
  const checkpoint = buildRepositoryAgentContexts(events)[0]!;
  expect(checkpoint.complete).toBe(true);
  expect(
    commitComments(events, [checkpoint.eventId], checkpoint.commitIds[0]!),
  ).toHaveLength(1);
  expect(events.filter((event) => event.kind === 7)).toHaveLength(1);
  expect(
    checkpoint.records.some(
      (record) =>
        record.kind === "transcript" &&
        JSON.parse(record.text!).payload.kind === "thinking",
    ),
  ).toBe(true);
  for (const record of checkpoint.records.filter(
    (record) =>
      record.kind === "transcript" &&
      JSON.parse(record.text!).payload.kind === "message",
  )) {
    const source = events.find((event) => event.id === record.sourceEventId)!;
    expect(source.kind).toBe(9);
    expect(source.pubkey).toBe(record.authorPubkey);
    expect(source.content).toBe(JSON.parse(record.text!).payload.text);
  }
});
