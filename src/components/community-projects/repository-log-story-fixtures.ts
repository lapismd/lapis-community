import type { NostrEvent } from "../../protocol/index.js";
import {
  KIND_JJ_AGENT_CONTEXT_PAGE,
  KIND_JJ_CHECKPOINT_MANIFEST,
  KIND_JJ_GRAPH_MANIFEST,
  KIND_JJ_OPERATION_GRAPH,
  KIND_JJ_REVISION,
  KIND_JJ_VIEW,
} from "../../projects/work-item-filters.js";

const owner = "1".repeat(64);
export const parent = "a".repeat(40);
export const left = "b".repeat(40);
const right = "c".repeat(40);
export const merge = "d".repeat(40);
const scope = "019d0000-0000-7000-8000-000000000001";
export const operation = "2".repeat(128);
const address = "30617:owner:probe";

function event(
  id: string,
  kind: number,
  createdAt: number,
  content: unknown,
  tags: string[][] = [["a", address]],
): NostrEvent {
  return {
    id: id.repeat(64).slice(0, 64),
    kind,
    pubkey: owner,
    created_at: createdAt,
    tags,
    content: JSON.stringify(content),
    sig: "f".repeat(128),
  };
}

function revision(
  id: string,
  createdAt: number,
  commitId: string,
  parents: string[],
  description: string,
  extras: Record<string, unknown> = {},
): NostrEvent {
  return event(id, KIND_JJ_REVISION, createdAt, {
    schema: "jj-sync/revision",
    commit_id: commitId,
    change_id_hex: `${id}${"a".repeat(31)}`.slice(0, 32),
    parent_commit_ids: parents,
    description,
    author: {
      name: "Maya Chen",
      email: "maya@example.test",
      timestamp_ms: createdAt * 1_000,
    },
    ...extras,
  });
}

export const events = [
  revision("1", 10, parent, [], ""),
  revision("2", 11, left, [parent], "lane a"),
  revision("3", 12, right, [parent], "lane b"),
  revision("7", 12, "9".repeat(40), [left, right], "merge lane A and lane B", {
    change_id_hex: "4".padEnd(32, "a"),
  }),
  revision("4", 13, merge, [left, right], "record merged lanes"),
  event("5", KIND_JJ_VIEW, 14, {
    schema: "jj-sync/view",
    view_id: "f".repeat(128),
    head_commit_ids: [merge],
    local_bookmarks: [
      { name: "main", target: { state: "resolved", commit_id: merge } },
    ],
    workspaces: [
      { native_workspace_name: "default", working_copy_commit_id: merge },
    ],
  }),
  event("8", KIND_JJ_OPERATION_GRAPH, 15, {
    schema: "jj-sync/operation-graph",
    operation_id: "1".repeat(128),
    parent_operation_ids: [],
    view_id: "f".repeat(128),
    metadata: {
      description: "snapshot working copy",
      started_at_ms: 14_000,
      ended_at_ms: 15_000,
    },
    evolution: { recording: "recorded", entries: [] },
  }),
  event("9", KIND_JJ_OPERATION_GRAPH, 16, {
    schema: "jj-sync/operation-graph",
    operation_id: operation,
    parent_operation_ids: ["1".repeat(128)],
    view_id: "f".repeat(128),
    metadata: {
      description: `record merged lanes ${merge}`,
      started_at_ms: 15_000,
      ended_at_ms: 16_000,
    },
    evolution: {
      recording: "recorded",
      entries: [
        {
          commit_id: merge,
          predecessor_commit_ids: ["9".repeat(40)],
        },
      ],
    },
  }),
  event(
    "a",
    KIND_JJ_GRAPH_MANIFEST,
    17,
    {
      schema: "jj-sync/graph-publication",
      version: 1,
      scope_id: scope,
      context: {
        operation_id: operation,
        view_id: "f".repeat(128),
      },
      selection: { seed_commit_ids: [merge] },
    },
    [
      ["r", scope],
      ["o", operation],
      ["a", address],
      ["h", "room"],
    ],
  ),
  event(
    "b",
    KIND_JJ_AGENT_CONTEXT_PAGE,
    18,
    {
      schema: "jj-sync/agent-context-page",
      version: 1,
      checkpoint_id: "checkpoint-1",
      span_id: "span-1",
      scope_id: scope,
      operation_id: operation,
      page_index: 0,
      page_count: 1,
      records: [
        {
          id: "user-1",
          sequence: 1,
          created_at_ms: 18_000,
          kind: "user_message",
          text: "Please **merge the lanes** and preserve history.",
        },
        {
          id: "tool-1",
          sequence: 2,
          created_at_ms: 18_100,
          kind: "tool",
          tool_name: "apply_patch",
          tool_state: "completed",
        },
        {
          id: "assistant-1",
          sequence: 3,
          created_at_ms: 18_200,
          kind: "assistant_message",
          text: "Merged both lanes and published the checkpoint.",
        },
      ],
    },
    [
      ["r", scope],
      ["o", operation],
      ["d", "checkpoint-1"],
      ["a", address],
      ["h", "room"],
    ],
  ),
  event(
    "c",
    KIND_JJ_CHECKPOINT_MANIFEST,
    19,
    {
      schema: "jj-sync/checkpoint-manifest",
      version: 1,
      checkpoint_id: "checkpoint-1",
      span_id: "span-1",
      scope_id: scope,
      operation_id: operation,
      page_event_ids: ["b".repeat(64)],
      record_count: 3,
      complete: false,
      outcome: "completed",
    },
    [
      ["r", scope],
      ["o", operation],
      ["d", "checkpoint-1"],
      ["a", address],
      ["h", "room"],
    ],
  ),
];
