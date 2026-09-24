import { expect, it } from "vitest";
import { pendingTranscriptStatuses } from "./transcript-progress.js";
import { transcriptToolProps } from "./transcript-tool-props.js";
import { canonicalFixtureRecord } from "../../fixture/canonical-agent-records.js";
import { transcriptRecordStates } from "./transcript-execution.js";
import type {
  CommunityAgentActivityItem,
  CommunityAgentsState,
} from "../../community/agent-contracts.js";
const activity: CommunityAgentActivityItem[] = [
  {
    id: "event",
    agentPubkey: "agent",
    createdAt: 1,
    frame: {
      version: 2,
      kind: "request_status",
      seq: 1,
      channelId: "general",
      sessionId: "session",
      turnId: "turn",
      timestamp: "2026-09-19T00:00:00Z",
      payload: {
        scopeKey: "scope/thread/root",
        lifecycleRequestId: "request",
        state: "running",
        preview: "Working",
      },
    },
  },
];
const execution: Pick<
  CommunityAgentsState,
  "conversationScopes" | "activityUnavailable"
> = {
  activityUnavailable: [
    {
      agentPubkey: "agent",
      context: { kind: "thread", channelId: "general", threadRootId: "root" },
    },
  ],
};
it("stops cached progress when its exact conversation cannot catch up", () => {
  expect(
    pendingTranscriptStatuses(
      activity,
      "agent",
      undefined,
      Date.now(),
      execution,
    ),
  ).toEqual([{ id: "request", text: "Status unavailable", streaming: false }]);
  expect(
    pendingTranscriptStatuses(
      activity,
      "other",
      undefined,
      Date.now(),
      execution,
    ),
  ).toEqual([]);
});
it("uses a fresh current turn projection over an unavailable conversation", () => {
  expect(
    pendingTranscriptStatuses(activity, "agent", undefined, Date.now(), {
      ...execution,
      conversationScopes: {
        current: {
          agentPubkey: "agent",
          scopeKey: "scope/thread/root",
          sessionId: "session",
          turnId: "turn",
          requestId: "request",
          active: true,
          state: "waiting_input",
        },
      },
    }),
  ).toEqual([
    { id: "request", text: "Waiting for your answer", streaming: false },
  ]);
});
it("does not keep completed snapshot execution working from cached frames", () => {
  expect(
    pendingTranscriptStatuses(activity, "agent", undefined, Date.now(), {
      ...execution,
      conversationScopes: {
        current: {
          agentPubkey: "agent",
          scopeKey: "scope/thread/root",
          sessionId: "session",
          turnId: "turn",
          requestId: "request",
          active: false,
          state: "completed",
        },
      },
    }),
  ).toEqual([]);
});
it("shows missing tool outcomes as unknown without changing observed input", () => {
  const tool = {
    id: "tool",
    type: "tool" as const,
    toolId: "tool",
    name: "Read",
    state: "running" as const,
    input: '{"path":"README.md"}',
    createdAt: "2026-09-19T00:00:00Z",
  };
  const result = transcriptToolProps(tool, undefined!, true);
  expect(result.status).toBe("unknown");
  expect(result.data).toBe(tool);
  expect(tool.state).toBe("running");
});
it("projects unavailable canonical tool records after fragment reconstruction", () => {
  const record = canonicalFixtureRecord(
    {
      kind: "tool-invocation",
      invocationId: "read",
      name: "Read",
      input: { path: "README.md" },
    },
    1,
  );
  const source = activity[0]!;
  const captured = {
    ...source,
    frame: {
      ...source.frame,
      kind: "transcript_record",
      sessionId: record.threadId,
      turnId: record.turnId,
      payload: {
        scopeKey: "scope/thread/root",
        capture: {
          schema: "lapis.transcript-fragment/1",
          recordId: record.id,
          index: 0,
          count: 1,
          data: JSON.stringify(record),
        },
      },
    },
  };
  expect(
    transcriptRecordStates([captured], "agent", execution).get(
      `${record.turnId}:tool:read`,
    ),
  ).toBe("unknown");
});
it("isolates record identities reused by the same agent in simultaneous threads", async () => {
  const { transcriptRecordStates } = await import("./transcript-execution.js");
  const first = activity[0]!;
  const entries = [
    {
      ...first,
      frame: {
        ...first.frame,
        payload: {
          ...(first.frame.payload as object),
          entry: { id: "shared" },
        },
      },
    },
    {
      ...first,
      id: "other",
      frame: {
        ...first.frame,
        payload: { scopeKey: "scope/thread/other", entry: { id: "shared" } },
      },
    },
  ];
  const context = {
    kind: "thread" as const,
    channelId: "general",
    threadRootId: "root",
  };
  expect(
    transcriptRecordStates(
      entries,
      "agent",
      {
        ...execution,
        conversationScopes: {
          other: {
            agentPubkey: "agent",
            scopeKey: "scope/thread/other",
            sessionId: "session",
            turnId: "turn",
            active: true,
            state: "running",
          },
        },
      },
      context,
    ).get("shared"),
  ).toBe("unknown");
});
