import { expect, it } from "vitest";
import { canonicalFixtureRecord } from "../fixture/canonical-agent-records.js";
import { parseCanonicalTranscript } from "../protocol/agent-transcript.js";
import { canonicalActivity } from "./canonical-transcript-activity.js";
import type { CommunityAgentActivityItem } from "./agent-contracts.js";

it("reassembles once across reorder and replay and never renders incomplete text", () => {
  const record = canonicalFixtureRecord(
    {
      kind: "thinking",
      visible: true,
      blockId: "thought",
      text: "Completed visible thought",
    },
    1,
  );
  const text = JSON.stringify(record);
  const fragments = [text.slice(0, 70), text.slice(70)];
  const events: CommunityAgentActivityItem[] = fragments.map((data, index) => ({
    id: `frame-${index}`,
    agentPubkey: "agent",
    createdAt: index,
    frame: {
      version: 2,
      seq: index + 1,
      sessionId: record.threadId,
      turnId: record.turnId,
      timestamp: new Date(record.at).toISOString(),
      kind: "transcript_record",
      payload: {
        capture: {
          schema: "lapis.transcript-fragment/1",
          recordId: record.id,
          index,
          count: 2,
          data,
        },
      },
    },
  }));
  const complete = canonicalActivity([events[1]!, events[0]!, events[0]!]);
  expect(complete).toHaveLength(1);
  expect(complete[0]?.frame.payload).toMatchObject({
    entry: {
      type: "thinking",
      text: "Completed visible thought",
      state: "done",
    },
  });
  const incomplete = canonicalActivity([events[0]!]);
  expect(incomplete[0]?.frame.payload).toMatchObject({
    entry: { label: "Capture gap" },
  });
  expect(JSON.stringify(incomplete[0]?.frame.payload)).not.toContain(
    text.slice(0, 70),
  );
  expect(
    parseCanonicalTranscript(JSON.stringify({ ...record, sanitization: {} })),
  ).toBeUndefined();
  expect(
    parseCanonicalTranscript(
      JSON.stringify({
        ...record,
        payload: { kind: "thinking", visible: false, text: "opaque" },
      }),
    ),
  ).toBeUndefined();
});

it("keeps the public allowlist and hides leftover coverage rows", () => {
  const usage = canonicalFixtureRecord(
    { kind: "usage", used: 8, limit: 10 },
    2,
  );
  const leftovers = [
    canonicalFixtureRecord({ kind: "lifecycle", state: "capture_coverage" }, 3),
    canonicalFixtureRecord({ kind: "file", path: "README.md" }, 4),
    canonicalFixtureRecord({ kind: "command", command: "git status" }, 5),
  ];
  const events: CommunityAgentActivityItem[] = [usage, ...leftovers].map(
    (record) => ({
      id: record.id,
      agentPubkey: "agent",
      createdAt: record.sequence,
      frame: {
        version: 2,
        seq: record.sequence,
        sessionId: record.threadId,
        turnId: record.turnId,
        timestamp: new Date(record.at).toISOString(),
        kind: "transcript_record",
        payload: {
          capture: {
            schema: "lapis.transcript-fragment/1",
            recordId: record.id,
            index: 0,
            count: 1,
            data: JSON.stringify(record),
          },
        },
      },
    }),
  );
  const projected = canonicalActivity(events);
  expect(projected).toHaveLength(1);
  expect(projected[0]?.frame.payload).toMatchObject({
    entry: { type: "usage", used: 8, limit: 10 },
  });
});

it("keeps invocation names and command envelopes instead of Tool result or null", () => {
  const invocation = canonicalFixtureRecord(
    {
      kind: "tool-invocation",
      invocationId: "exec",
      name: "bash",
      input: {
        command: "git status",
        kind: "execute",
        locations: [{ path: "README.md" }],
      },
    },
    1,
  );
  const result = canonicalFixtureRecord(
    {
      kind: "tool-result",
      invocationId: "exec",
      name: "bash",
      outcome: "succeeded",
      output: "On branch main",
    },
    2,
  );
  const empty = canonicalFixtureRecord(
    {
      kind: "tool-invocation",
      invocationId: "empty",
      name: "bash",
      input: null,
    },
    3,
  );
  const events: CommunityAgentActivityItem[] = [invocation, result, empty].map(
    (record) => ({
      id: record.id,
      agentPubkey: "agent",
      createdAt: record.sequence,
      frame: {
        version: 2,
        seq: record.sequence,
        sessionId: record.threadId,
        turnId: record.turnId,
        timestamp: new Date(record.at).toISOString(),
        kind: "transcript_record",
        payload: {
          capture: {
            schema: "lapis.transcript-fragment/1",
            recordId: record.id,
            index: 0,
            count: 1,
            data: JSON.stringify(record),
          },
        },
      },
    }),
  );
  const projected = canonicalActivity(events).map(
    (item) => item.frame.payload as { entry?: Record<string, unknown> },
  );
  expect(projected[0]?.entry).toMatchObject({
    type: "tool",
    name: "bash",
    input: expect.stringContaining('"command": "git status"'),
  });
  expect(projected[0]?.entry?.input).toContain('"kind": "execute"');
  expect(projected[1]?.entry).toMatchObject({
    type: "tool",
    name: "bash",
    output: "On branch main",
  });
  expect(projected[1]?.entry?.name).not.toBe("Tool result");
  expect(projected[2]?.entry).toMatchObject({ type: "tool", name: "bash" });
  expect(JSON.stringify(projected[2]?.entry)).not.toContain("null");
});
