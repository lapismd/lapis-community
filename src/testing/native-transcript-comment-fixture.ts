import { transcriptCommentFixture } from "./transcript-comment-fixture.js";

/** The checkpoint service emits native v2 records, without a canonical envelope. */
export function nativeTranscriptCommentFixture() {
  const fixture = transcriptCommentFixture();
  const records: Record<string, unknown>[] = fixture.records
    .filter((record) => JSON.parse(record.text).payload.kind !== "tool-result")
    .map((record) => {
      const payload = JSON.parse(record.text).payload;
      const { text: _text, kind: _kind, ...base } = record;
      if (payload.kind === "message")
        return { ...base, kind: `${payload.role}_message`, text: payload.text };
      if (payload.kind === "thinking")
        return { ...base, kind: "thinking", text: payload.text };
      if (payload.kind === "plan")
        return { ...base, kind: "plan", entries: payload.entries };
      return {
        ...base,
        kind: "tool",
        tool_id: payload.invocationId,
        tool_name: payload.name,
        tool_state: "completed",
        ...(payload.input
          ? { input: JSON.stringify(payload.input), output: "README contents" }
          : {}),
        ...(payload.output ? { output: payload.output } : {}),
      };
    });
  records.push(
    {
      id: "permission",
      sequence: 7,
      created_at_ms: 1800000000007,
      kind: "permission",
      tool_name: "Write file",
      tool_state: "resolved",
      options: ["allow-once"],
    },
    {
      id: "usage",
      sequence: 8,
      created_at_ms: 1800000000008,
      kind: "usage",
      used: 42,
    },
  );
  const page = fixture.pages[0]!;
  const pages = records.map((record) =>
    fixture.sign(
      {
        ...page,
        content: JSON.stringify({
          ...JSON.parse(page.content),
          version: 2,
          records: [record],
        }),
      },
      true,
    ),
  );
  const checkpoint = fixture.sign(
    {
      ...fixture.checkpoint,
      content: JSON.stringify({
        ...JSON.parse(fixture.checkpoint.content),
        version: 2,
        page_event_ids: pages.map((page) => page.id),
        record_count: records.length,
      }),
    },
    true,
  );
  return {
    ...fixture,
    pages,
    checkpoint,
    events: [fixture.root, ...pages, checkpoint],
  };
}
