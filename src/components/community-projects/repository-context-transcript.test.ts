import { describe, expect, it } from "vitest";
import { canonicalFixtureRecord } from "../../fixture/canonical-agent-records.js";
import type { RepositoryAgentCheckpoint } from "../../projects/repository-agent-context.js";
import { repositoryContextTurns } from "./repository-context-transcript.js";

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
