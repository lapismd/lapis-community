import { expect, it } from "vitest";
import { canonicalFixtureRecord } from "../fixture/canonical-agent-records.js";
import { canonicalActivity } from "./canonical-transcript-activity.js";

it("keeps canonical plan records as type plan", () => {
  const record = canonicalFixtureRecord(
    {
      kind: "plan",
      entries: [
        {
          content: "Inspect README and update the checkpoint guide",
          status: "completed",
        },
      ],
    },
    2,
  );
  expect(
    canonicalActivity([
      {
        id: "plan",
        agentPubkey: "agent",
        createdAt: 2,
        frame: {
          version: 2,
          seq: 2,
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
      },
    ])[0]?.frame.payload,
  ).toMatchObject({
    entry: {
      type: "plan",
      entries: [
        {
          content: "Inspect README and update the checkpoint guide",
          status: "completed",
        },
      ],
    },
  });
});
