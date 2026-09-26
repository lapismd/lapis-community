import { describe, expect, it } from "vitest";
import { parseAgentObserverEnvelope } from "./agent-observer-envelope.js";

const timestamp = "2026-09-26T21:00:00.000Z";

function batch(records: unknown[], overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    version: 3,
    seq: 8,
    streamId: "stream-1",
    timestamp,
    kind: "batch",
    channelId: "general",
    sessionId: "session-1",
    turnId: "turn-1",
    records,
    ...overrides,
  });
}

function record(id: string, seq: number, kind = "request_status") {
  return { id, seq, timestamp, kind, payload: { state: "running" } };
}

describe("agent observer envelopes", () => {
  it("normalizes version-2 frames as one record", () => {
    const decoded = parseAgentObserverEnvelope(
      JSON.stringify({
        version: 2,
        seq: 4,
        streamId: "stream-1",
        timestamp,
        kind: "turn_completed",
        payload: {},
      }),
    );
    expect(decoded).toMatchObject({
      batched: false,
      cursorSeq: 4,
      records: [{ cursorSeq: 4, frame: { kind: "turn_completed", seq: 4 } }],
    });
    expect(decoded?.records[0]?.id).toBeUndefined();
  });

  it("sorts bounded progress records and inherits envelope scope", () => {
    const decoded = parseAgentObserverEnvelope(
      batch([
        record("status-b", 5),
        { ...record("status-a", 5), sessionId: "session-override" },
        record("thought", 3, "thinking_chunk"),
      ]),
    );
    expect(decoded?.records.map(({ id }) => id)).toEqual([
      "thought",
      "status-a",
      "status-b",
    ]);
    expect(decoded?.records[1]).toMatchObject({
      cursorSeq: 8,
      frame: {
        version: 2,
        streamId: "stream-1",
        channelId: "general",
        sessionId: "session-override",
        turnId: "turn-1",
      },
    });
  });

  it("rejects duplicate identities, terminal records, invalid payloads and bounds", () => {
    expect(
      parseAgentObserverEnvelope(batch([record("same", 1), record("same", 2)])),
    ).toBeUndefined();
    expect(
      parseAgentObserverEnvelope(
        batch([record("terminal", 1, "turn_completed")]),
      ),
    ).toBeUndefined();
    expect(
      parseAgentObserverEnvelope(
        batch([{ ...record("payload", 1), payload: [] }]),
      ),
    ).toBeUndefined();
    expect(
      parseAgentObserverEnvelope(
        batch(
          Array.from({ length: 21 }, (_, index) => record(`r-${index}`, index)),
        ),
      ),
    ).toBeUndefined();
    expect(
      parseAgentObserverEnvelope(
        batch([
          {
            ...record("large", 1),
            payload: { text: "x".repeat(25 * 1_024) },
          },
        ]),
      ),
    ).toBeUndefined();
  });
});
