import { describe, expect, it } from "vitest";
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
});
