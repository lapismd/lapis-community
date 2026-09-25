import { describe, expect, it } from "vitest";
import { canonicalFixtureRecord } from "../../fixture/canonical-agent-records.js";
import type { RepositoryAgentCheckpoint } from "../../projects/repository-agent-context.js";
import {
  formatRepositoryContextDuration,
  repositoryContextTurns,
} from "./repository-context-transcript.js";

function checkpoint(
  eventId: string,
  commitIds: string[],
  createdAt = 0,
): RepositoryAgentCheckpoint {
  return {
    eventId,
    checkpointId: eventId,
    spanId: "turn",
    scopeId: "scope",
    operationId: eventId,
    authorPubkey: "agent",
    commitIds,
    createdAt,
    complete: true,
    outcome: "completed",
    records: [],
  };
}

describe("repository context checkpoint links", () => {
  it("reports session duration from the first and last context records", () => {
    const turns = repositoryContextTurns([
      {
        ...checkpoint("ctx", []),
        records: [
          canonicalFixtureRecord({ kind: "thinking", text: "Started" }, 1),
          canonicalFixtureRecord({ kind: "thinking", text: "Finished" }, 2),
        ].map((record, index) => ({
          id: `record-${index}`,
          sequence: index,
          createdAt: 1_700_000_000_000 + index * 125_000,
          kind: "transcript" as const,
          text: JSON.stringify(record),
        })),
      },
    ]);

    expect(turns[0]?.sessionTiming).toMatchObject({
      durationMs: 125_000,
      label: "2m 5s",
    });
  });

  it("falls back to checkpoint event times when records are unavailable", () => {
    const turns = repositoryContextTurns([
      checkpoint("first", [], 10),
      checkpoint("second", [], 72),
    ]);

    expect(turns[0]?.sessionTiming).toMatchObject({
      durationMs: 62_000,
      label: "1m 2s",
    });
  });

  it("formats compact session durations", () => {
    expect(formatRepositoryContextDuration(0)).toBe("0s");
    expect(formatRepositoryContextDuration(2_000)).toBe("2s");
    expect(formatRepositoryContextDuration(3_600_000)).toBe("1h");
    expect(formatRepositoryContextDuration(90_000_000)).toBe("1d 1h");
  });
  it("shows each commit once within and across checkpoints in a turn", () => {
    const first = "2".repeat(40);
    const second = "3".repeat(40);
    const third = "4".repeat(40);
    const checkpoints = [
      checkpoint("later", [first, third, third, second], 2),
      checkpoint("earlier", [first, first, second, second], 1),
    ];

    const turns = repositoryContextTurns(checkpoints);

    expect(turns[0]?.segments.map((segment) => segment.commitIds)).toEqual([
      [first, second],
      [third],
    ]);
    expect(checkpoints[1]?.commitIds).toEqual([first, first, second, second]);
  });

  it("keeps a commit link in each independent turn", () => {
    const commit = "2".repeat(40);
    const turns = repositoryContextTurns([
      checkpoint("first", [commit]),
      { ...checkpoint("second", [commit]), spanId: "another-turn" },
    ]);

    expect(turns.map((turn) => turn.segments[0]?.commitIds)).toEqual([
      [commit],
      [commit],
    ]);
  });

  it("projects first-class plan, permission, and usage and hides leftovers", () => {
    const leftover = canonicalFixtureRecord(
      { kind: "lifecycle", state: "capture_coverage" },
      4,
    );
    const leftoverFile = canonicalFixtureRecord(
      { kind: "file", path: "README.md" },
      5,
    );
    const leftoverCommand = canonicalFixtureRecord(
      { kind: "command", command: "git status" },
      6,
    );
    const turns = repositoryContextTurns([
      {
        ...checkpoint("ctx", ["2".repeat(40)]),
        records: [
          {
            id: "plan-1",
            sequence: 1,
            createdAt: 1,
            kind: "plan",
            entries: [{ content: "Inspect README", status: "completed" }],
          },
          {
            id: "perm-1",
            sequence: 2,
            createdAt: 2,
            kind: "permission",
            toolName: "apply_patch",
            toolState: "resolved",
            decision: "allow_once",
            options: ["allow_once", "deny"],
          },
          {
            id: "usage-1",
            sequence: 3,
            createdAt: 3,
            kind: "usage",
            used: 8,
            limit: 10,
          },
          {
            id: "tool-1",
            sequence: 4,
            createdAt: 4,
            kind: "tool",
            toolId: "exec",
            toolName: "bash",
            toolState: "completed",
            input: '{"command":"git status","kind":"execute"}',
          },
          {
            id: "leftover-1",
            sequence: 5,
            createdAt: 5,
            kind: "transcript",
            text: JSON.stringify(leftover),
          },
          {
            id: "leftover-file",
            sequence: 6,
            createdAt: 6,
            kind: "transcript",
            text: JSON.stringify(leftoverFile),
          },
          {
            id: "leftover-command",
            sequence: 7,
            createdAt: 7,
            kind: "transcript",
            text: JSON.stringify(leftoverCommand),
          },
        ],
      },
    ]);
    const entries = turns[0]?.segments[0]?.activity.map((item) => {
      const payload = item.frame.payload;
      return payload && typeof payload === "object" && "entry" in payload
        ? payload.entry
        : undefined;
    });
    expect(entries).toEqual([
      expect.objectContaining({
        type: "plan",
        entries: [{ content: "Inspect README", status: "completed" }],
      }),
      expect.objectContaining({
        type: "permission",
        tool: "apply_patch",
        decision: "allow_once",
      }),
      expect.objectContaining({ type: "usage", used: 8, limit: 10 }),
      expect.objectContaining({
        type: "tool",
        name: "bash",
        input: '{"command":"git status","kind":"execute"}',
      }),
    ]);
  });
});
