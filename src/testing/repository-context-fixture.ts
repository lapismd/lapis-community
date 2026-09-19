import {
  KIND_JJ_CHECKPOINT_MANIFEST,
  KIND_JJ_AGENT_CONTEXT_PAGE,
} from "../projects/work-item-filters.js";
import type { NostrEvent } from "../protocol/index.js";

export const contextFixture = {
  agent: "9".repeat(64),
  user: "1".repeat(64),
  commit: "b".repeat(40),
  operation: "a".repeat(128),
  baseline: "c".repeat(128),
  repository: `30617:${"1".repeat(64)}:probe`,
  scope: "fixture-scope",
  span: "fixture-turn",
};

export function repositoryContextEvents(): NostrEvent[] {
  const f = contextFixture;
  const records = [
    {
      id: "prompt",
      sequence: 0,
      kind: "user_message",
      text: "Update the README with a checkpoint example.",
      author_pubkey: f.user,
    },
    {
      id: "tool",
      sequence: 1,
      kind: "tool",
      tool_id: "edit-1",
      tool_name: "apply_patch",
      tool_state: "completed",
      input: "README.md: add checkpoint example",
      output: "Success. Updated README.md",
    },
    {
      id: "message",
      sequence: 2,
      kind: "assistant_message",
      text: "Updated the README and verified the diff.",
      author_pubkey: f.agent,
    },
  ];
  const event = (
    kind: number,
    index: number,
    body: Record<string, unknown>,
    operation: string,
    identifier: string,
  ): NostrEvent => ({
    kind,
    id: String(index).repeat(64),
    pubkey: f.agent,
    sig: "f".repeat(128),
    created_at: 1_700_000_000 + index,
    tags: [
      ["a", f.repository],
      ["h", "room"],
      ["r", f.scope],
      ["o", operation],
      ["d", identifier],
    ],
    content: JSON.stringify(body),
  });
  const pages = records.map((record, index) =>
    event(
      KIND_JJ_AGENT_CONTEXT_PAGE,
      index + 1,
      {
        schema: "jj-sync/agent-context-page",
        version: 2,
        checkpoint_id: f.span,
        span_id: f.span,
        scope_id: f.scope,
        operation_id: f.baseline,
        page_index: 0,
        page_count: 1,
        records: [
          { ...record, created_at_ms: 1_700_000_000_000 + index * 1000 },
        ],
      },
      f.baseline,
      f.span,
    ),
  );
  return [
    ...pages,
    event(
      KIND_JJ_CHECKPOINT_MANIFEST,
      4,
      {
        schema: "jj-sync/checkpoint-manifest",
        version: 2,
        checkpoint_id: "checkpoint",
        span_id: f.span,
        scope_id: f.scope,
        operation_id: f.operation,
        begin_operation_id: f.baseline,
        page_event_ids: pages.map((page) => page.id),
        record_count: records.length,
        complete: true,
        outcome: "completed",
        targets: [{ commit_id: f.commit, change_id_hex: "d".repeat(32) }],
        actor: {
          agent_id: "local-agent",
          pubkey: f.agent,
          name: "Nyra",
          email: "nyra@nostr.invalid",
        },
      },
      f.operation,
      "checkpoint",
    ),
  ];
}
