import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
import type { NostrEventTemplate } from "../protocol/index.js";
export function transcriptCommentFixture(nested = false) {
  const agentKey = new Uint8Array(32).fill(41),
    ownerKey = new Uint8Array(32).fill(42);
  const agent = getPublicKey(agentKey),
    owner = getPublicKey(ownerKey);
  const created_at = 1800000000,
    repository = `30617:${owner}:probe`;
  const sign = (template: NostrEventTemplate, asAgent = false) =>
    finalizeEvent(template, asAgent ? agentKey : ownerKey);
  const root = sign({
    kind: 9,
    created_at,
    content: "Review the repository",
    tags: [
      ["h", "general"],
      ["p", agent],
    ],
  });
  const request = nested
    ? sign({
        kind: 9,
        created_at: created_at + 1,
        content: "Continue the review",
        tags: [
          ["h", "general"],
          ["p", agent],
          ["e", root.id, "", "root"],
          ["e", root.id, "", "reply"],
        ],
      })
    : root;
  const payloads = [
    { kind: "message", role: "user", text: request.content },
    {
      kind: "message",
      role: "assistant",
      text: "Use Apache 2.0 for this repository.",
    },
    {
      kind: "thinking",
      visible: true,
      text: "Compare Apache 2.0 with MIT 🧭 before editing.",
    },
    {
      kind: "plan",
      entries: [
        { content: "Inspect the repository", status: "completed" },
        { content: "Add the license", status: "pending" },
      ],
    },
    {
      kind: "tool-invocation",
      invocationId: "read",
      name: "Read file",
      input: { path: "README.md" },
    },
    {
      kind: "tool-result",
      invocationId: "read",
      name: "Read file",
      outcome: "succeeded",
      output: "README contents",
    },
  ];
  const records = payloads.map((payload, index) => {
    const id = `record-${index}`,
      sequence = index + 1,
      at = created_at * 1000 + index;
    return {
      id,
      sequence,
      created_at_ms: at,
      kind: "transcript",
      ...(index === 0
        ? { source_event_id: request.id, author_pubkey: owner }
        : {}),
      text: JSON.stringify({
        schema: "lapis.transcript/1",
        id,
        sessionId: "session",
        threadId: "thread",
        turnId: "turn",
        attemptId: "attempt",
        sequence,
        at,
        source: { provider: "fixture" },
        payload,
        coverage: {
          mode: "managed-observable",
          observations: "complete-exposed",
          gaps: [],
        },
        sanitization: {
          policy: "public",
          redacted: false,
          pathsNormalized: true,
        },
      }),
    };
  });
  const tags = (operation: string, identifier: string) => [
    ["a", repository],
    ["h", "general"],
    ["r", "scope"],
    ["o", operation],
    ["d", identifier],
  ];
  const pages = records.map((record) =>
    sign(
      {
        kind: 3908,
        created_at,
        tags: tags("baseline", "span"),
        content: JSON.stringify({
          schema: "jj-sync/agent-context-page",
          version: 3,
          checkpoint_id: "span",
          span_id: "span",
          scope_id: "scope",
          operation_id: "baseline",
          page_index: 0,
          page_count: 1,
          records: [record],
        }),
      },
      true,
    ),
  );
  const checkpoint = sign(
    {
      kind: 3907,
      created_at,
      tags: tags("operation", "checkpoint"),
      content: JSON.stringify({
        schema: "jj-sync/checkpoint-manifest",
        version: 3,
        checkpoint_id: "checkpoint",
        span_id: "span",
        scope_id: "scope",
        operation_id: "operation",
        begin_operation_id: "baseline",
        page_event_ids: pages.map((p) => p.id),
        record_count: records.length,
        complete: true,
        outcome: "completed",
        targets: [],
        actor: { pubkey: agent },
      }),
    },
    true,
  );
  return {
    root,
    request,
    records,
    pages,
    checkpoint,
    repository,
    agent,
    owner,
    sign,
    events: [root, ...(nested ? [request] : []), ...pages, checkpoint],
  };
}
