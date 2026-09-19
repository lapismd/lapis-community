import { describe, expect, it } from "vitest";

import type { NostrEvent } from "../protocol/index.js";
import {
  buildRepositoryAgentContexts,
  repositoryAgentContextsForSelection,
} from "./repository-agent-context.js";
import {
  KIND_JJ_AGENT_CONTEXT_PAGE,
  KIND_JJ_CHECKPOINT_MANIFEST,
  KIND_JJ_GRAPH_MANIFEST,
} from "./work-item-filters.js";

const author = "1".repeat(64);
const address = `30617:${"2".repeat(64)}:notes`;
const scope = "019d0000-0000-7000-8000-000000000001";
const operation = "a".repeat(128);
const commit = "b".repeat(40);
const checkpoint = "checkpoint-1";
const span = "span-1";

function event(
  id: string,
  kind: number,
  content: unknown,
  tags: string[][],
  pubkey = author,
): NostrEvent {
  return {
    id: id.repeat(64).slice(0, 64),
    kind,
    pubkey,
    created_at: 100,
    tags,
    content: JSON.stringify(content),
    sig: "f".repeat(128),
  };
}

function page(id = "p", sequence = 1, pubkey = author): NostrEvent {
  return event(
    id,
    KIND_JJ_AGENT_CONTEXT_PAGE,
    {
      schema: "jj-sync/agent-context-page",
      version: 1,
      checkpoint_id: checkpoint,
      span_id: span,
      scope_id: scope,
      operation_id: operation,
      page_index: 0,
      page_count: 1,
      records: [
        {
          id: "user-1",
          sequence,
          created_at_ms: 100_000,
          kind: "user_message",
          text: "Update the repository context.",
          source_event_id: "c".repeat(64),
        },
        {
          id: "tool-1",
          sequence: sequence + 1,
          created_at_ms: 100_100,
          kind: "tool",
          tool_name: "apply_patch",
          tool_state: "completed",
        },
        {
          id: "assistant-1",
          sequence: sequence + 2,
          created_at_ms: 100_200,
          kind: "assistant_message",
          text: "Published the checkpoint.",
        },
      ],
    },
    [
      ["r", scope],
      ["o", operation],
      ["d", checkpoint],
      ["a", address],
      ["h", "room"],
    ],
    pubkey,
  );
}

function manifest(pageId = "p"): NostrEvent {
  return event(
    "m",
    KIND_JJ_CHECKPOINT_MANIFEST,
    {
      schema: "jj-sync/checkpoint-manifest",
      version: 1,
      checkpoint_id: checkpoint,
      span_id: span,
      scope_id: scope,
      operation_id: operation,
      page_event_ids: [pageId.repeat(64).slice(0, 64)],
      record_count: 3,
      complete: true,
      outcome: "completed",
    },
    [
      ["r", scope],
      ["o", operation],
      ["d", checkpoint],
      ["a", address],
      ["h", "room"],
    ],
  );
}

function graph(): NostrEvent {
  return event(
    "g",
    KIND_JJ_GRAPH_MANIFEST,
    {
      schema: "jj-sync/graph-publication",
      version: 1,
      scope_id: scope,
      context: { operation_id: operation },
      selection: { seed_commit_ids: [commit] },
    },
    [
      ["r", scope],
      ["o", operation],
      ["a", address],
      ["h", "room"],
    ],
  );
}

describe("repository agent context", () => {
  it("assembles referenced pages and binds log and op-log selections", () => {
    const contexts = buildRepositoryAgentContexts([
      page(),
      manifest(),
      graph(),
    ]);
    expect(contexts).toHaveLength(1);
    expect(contexts[0]).toMatchObject({
      checkpointId: checkpoint,
      operationId: operation,
      commitIds: [commit],
      complete: true,
      outcome: "completed",
    });
    expect(contexts[0]?.records.map((record) => record.kind)).toEqual([
      "user_message",
      "tool",
      "assistant_message",
    ]);
    expect(
      repositoryAgentContextsForSelection(contexts, "log", commit),
    ).toHaveLength(1);
    expect(
      repositoryAgentContextsForSelection(contexts, "oplog", operation),
    ).toHaveLength(1);
    expect(
      repositoryAgentContextsForSelection(contexts, "log", "missing"),
    ).toEqual([]);
  });

  it("rejects missing, cross-author, and invalid ordered pages", () => {
    expect(buildRepositoryAgentContexts([manifest(), graph()])).toEqual([]);
    expect(
      buildRepositoryAgentContexts([
        page("p", 1, "9".repeat(64)),
        manifest(),
        graph(),
      ]),
    ).toEqual([]);
    const invalid = page();
    const body = JSON.parse(invalid.content) as {
      records: { sequence: number }[];
    };
    body.records[1]!.sequence = body.records[0]!.sequence;
    invalid.content = JSON.stringify(body);
    expect(
      buildRepositoryAgentContexts([invalid, manifest(), graph()]),
    ).toEqual([]);
  });

  it("ignores unreferenced pages and mismatched graph bindings", () => {
    const extra = page("x", 10);
    const wrongGraph = graph();
    wrongGraph.tags = wrongGraph.tags.map((tag) =>
      tag[0] === "h" ? ["h", "elsewhere"] : tag,
    );
    const contexts = buildRepositoryAgentContexts([
      page(),
      extra,
      manifest(),
      wrongGraph,
    ]);
    expect(contexts[0]?.records).toHaveLength(3);
    expect(contexts[0]?.commitIds).toEqual([]);
  });
});
