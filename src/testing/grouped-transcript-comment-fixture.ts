import { transcriptCommentFixture } from "./transcript-comment-fixture.js";
export function groupedTranscriptCommentFixture() {
  const f = transcriptCommentFixture();
  const records = [
    ...f.records,
    ...f.records.slice(4).map((record, index) => {
      const canonical = JSON.parse(record.text);
      canonical.id = `record-${index + 6}`;
      canonical.sequence = index + 7;
      canonical.at += 2;
      canonical.payload = {
        ...canonical.payload,
        invocationId: "write",
        name: "Write file",
        ...(index === 0
          ? { input: { path: "LICENSE" } }
          : { output: "License saved" }),
      };
      return {
        ...record,
        id: canonical.id,
        sequence: canonical.sequence,
        created_at_ms: canonical.at,
        text: JSON.stringify(canonical),
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
