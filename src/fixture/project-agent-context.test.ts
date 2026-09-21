import { describe, expect, it } from "vitest";

import { event } from "./project-context-test-event.js";
import {
  buildRepositoryAgentContexts,
  repositoryAgentContextsForSelection,
} from "../projects/repository-agent-context.js";
import { buildRepositoryLog } from "../projects/repository-log.js";
import { buildRepositoryOperationLog } from "../projects/repository-operation-log.js";
import {
  createLocalProjectAgentContextFixture,
  LOCAL_AGENT_CONTEXT_IDS,
} from "./project-agent-context.js";

const agentPubkey = "9".repeat(64);

describe("local project agent context fixture", () => {
  it("projects into selectable Log and Op Log context", () => {
    const fixture = createLocalProjectAgentContextFixture({
      repositoryCoordinate: `30617:${"a".repeat(64)}:lapis-community`,
      channelId: "plugin-development",
      agentPubkey,
      createdAt: 1_700_000_000,
    });
    const events = fixture.publications.map(event);
    events.push(
      event(
        fixture.checkpointManifest(
          fixture.contextPageIndices.map((index) => events[index]!.id),
        ),
        events.length,
      ),
    );

    const log = buildRepositoryLog(events);
    const opLog = buildRepositoryOperationLog(events);
    const contexts = buildRepositoryAgentContexts(events);

    expect(log.revisions.map(({ eventId }) => eventId)).toEqual([
      LOCAL_AGENT_CONTEXT_IDS.agentCommitId,
      LOCAL_AGENT_CONTEXT_IDS.initialCommitId,
    ]);
    expect(log.revisions[0]?.message).toBe(
      "Show agent context beside JJ revisions",
    );
    expect(opLog.revisions[0]).toMatchObject({
      eventId: LOCAL_AGENT_CONTEXT_IDS.operationId,
      commitId: LOCAL_AGENT_CONTEXT_IDS.agentCommitId,
      message: "checkpoint agent context",
    });
    expect(
      repositoryAgentContextsForSelection(
        contexts,
        "log",
        LOCAL_AGENT_CONTEXT_IDS.agentCommitId,
      ),
    ).toHaveLength(1);
    expect(
      repositoryAgentContextsForSelection(
        contexts,
        "oplog",
        LOCAL_AGENT_CONTEXT_IDS.operationId,
      ),
    ).toHaveLength(1);
    expect(contexts[0]?.records).toHaveLength(8);
    expect(
      contexts[0]?.records.every((record) => record.kind === "transcript"),
    ).toBe(true);
    const payloads = contexts[0]!.records.map(
      (record) => JSON.parse(record.text!).payload,
    );
    expect(payloads.map((payload) => payload.kind)).toEqual([
      "message",
      "plan",
      "thinking",
      "tool-invocation",
      "tool-result",
      "permission",
      "usage",
      "message",
    ]);
    expect(payloads[3].input.path).toBe("$WORKSPACE[local]/README.md");
  });
});
