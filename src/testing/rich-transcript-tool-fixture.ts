import { transcriptCommentFixture } from "./transcript-comment-fixture.js";

export function richTranscriptToolFixture() {
  const f = transcriptCommentFixture();
  const createdAt = 1_800_000_000_010;
  const toolPayloads = [
    {
      kind: "tool-invocation",
      invocationId: "edit",
      name: "edit_file",
      input: {
        path: "fixture.ts",
        oldText: 'export const smokeValue = "old";\n',
        newText: 'export const smokeValue = "new";\n',
      },
    },
    {
      kind: "tool-result",
      invocationId: "edit",
      name: "edit_file",
      outcome: "succeeded",
      output: {
        path: "fixture.ts",
        oldText: 'export const smokeValue = "old";\n',
        newText: 'export const smokeValue = "new";\n',
      },
    },
    {
      kind: "tool-invocation",
      invocationId: "shell",
      name: "bash",
      input: { command: "pnpm test -- transcript-tool-rich.test.ts" },
    },
    {
      kind: "tool-result",
      invocationId: "shell",
      name: "bash",
      outcome: "succeeded",
      output: { stdout: "Tests: 6 passed" },
    },
    {
      kind: "tool-invocation",
      invocationId: "search",
      name: "bash",
      input: { command: "rg -n 'compare|sort' src/community" },
    },
    {
      kind: "tool-result",
      invocationId: "search",
      name: "bash",
      outcome: "succeeded",
      output: [
        "src/community/materialize-messages.ts:20:const compare = sortEvents();",
        "src/community/materialize-messages.ts:42:items.sort(compare);",
      ].join("\n"),
    },
  ];
  const records = [
    ...f.records.slice(0, 4),
    ...toolPayloads.map((payload, index) => {
      const id = `rich-record-${index}`;
      return {
        id,
        sequence: index + 5,
        created_at_ms: createdAt + index,
        kind: "transcript",
        text: JSON.stringify({
          schema: "lapis.transcript/1",
          id,
          sessionId: "session",
          threadId: "thread",
          turnId: "turn",
          attemptId: "attempt",
          sequence: index + 5,
          at: createdAt + index,
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
    }),
  ];
  const pages = records.map((record) =>
    f.sign(
      {
        ...f.pages[0]!,
        content: JSON.stringify({
          ...JSON.parse(f.pages[0]!.content),
          records: [record],
        }),
      },
      true,
    ),
  );
  const checkpoint = f.sign(
    {
      ...f.checkpoint,
      content: JSON.stringify({
        ...JSON.parse(f.checkpoint.content),
        page_event_ids: pages.map((page) => page.id),
        record_count: records.length,
      }),
    },
    true,
  );
  return {
    ...f,
    records,
    pages,
    checkpoint,
    events: [f.root, ...pages, checkpoint],
  };
}
