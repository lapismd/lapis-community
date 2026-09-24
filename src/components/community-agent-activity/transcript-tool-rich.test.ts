import { describe, expect, it } from "vitest";
import type { TranscriptToolEntry } from "./transcript-tool-rich.js";
import {
  fileEditStats,
  richTranscriptToolDetail,
  richTranscriptToolLabel,
  transcriptToolGroupLabel,
} from "./transcript-tool-rich.js";

function tool(patch: Partial<TranscriptToolEntry>): TranscriptToolEntry {
  return {
    id: "turn:tool",
    type: "tool",
    toolId: "tool",
    name: "Tool",
    state: "completed",
    createdAt: "2026-09-24T12:00:00.000Z",
    ...patch,
  };
}

describe("rich transcript tool output", () => {
  it("detects file edits from old and new text envelopes", () => {
    const detail = richTranscriptToolDetail(
      tool({
        name: "edit_file",
        input: JSON.stringify({
          path: "fixture.ts",
          oldText: 'export const smokeValue = "old";\n',
          newText: 'export const smokeValue = "new";\n',
        }),
      }),
    );

    expect(detail).toMatchObject({
      kind: "file-edit",
      files: [
        {
          path: "fixture.ts",
          oldText: 'export const smokeValue = "old";\n',
          newText: 'export const smokeValue = "new";\n',
        },
      ],
    });
    expect(fileEditStats(detail)).toEqual({ additions: 1, deletions: 1 });
  });

  it("deduplicates edit envelopes repeated in input and output", () => {
    const edit = {
      path: "fixture.ts",
      oldText: 'export const smokeValue = "old";\n',
      newText: 'export const smokeValue = "new";\n',
    };
    const detail = richTranscriptToolDetail(
      tool({
        name: "edit_file",
        input: JSON.stringify(edit),
        output: JSON.stringify(edit),
      }),
    );

    expect(detail).toMatchObject({
      kind: "file-edit",
      files: [{ path: "fixture.ts" }],
    });
    expect(detail?.kind === "file-edit" ? detail.files : []).toHaveLength(1);
  });

  it("detects file edits from unified patches", () => {
    const patch = [
      "diff --git a/fixture.ts b/fixture.ts",
      "--- a/fixture.ts",
      "+++ b/fixture.ts",
      "@@ -1 +1 @@",
      '-export const smokeValue = "old";',
      '+export const smokeValue = "new";',
    ].join("\n");

    const detail = richTranscriptToolDetail(
      tool({ name: "apply_patch", output: patch }),
    );

    expect(detail).toMatchObject({
      kind: "file-edit",
      files: [{ path: "fixture.ts", patch, additions: 1, deletions: 1 }],
    });
    expect(
      richTranscriptToolLabel(tool({ name: "apply_patch", output: patch })),
    ).toBe("Edited file");
  });

  it("detects shell command input and output", () => {
    const detail = richTranscriptToolDetail(
      tool({
        name: "bash",
        input: JSON.stringify({ command: "pnpm test -- --runInBand" }),
        output: JSON.stringify({
          stdout: "Tests: 3 passed",
          stderr: "cache warmup skipped",
        }),
      }),
    );

    expect(detail).toEqual({
      kind: "shell",
      command: "pnpm test -- --runInBand",
      output: "Tests: 3 passed",
      error: "cache warmup skipped",
    });
  });

  it("detects ripgrep output as search matches", () => {
    const detail = richTranscriptToolDetail(
      tool({
        name: "bash",
        input: JSON.stringify({
          command: "rg -n 'compare|sort' src/community",
        }),
        output: [
          "src/community/materialize-messages.ts:20:const compare = sortEvents();",
          "src/community/materialize-messages.ts:42:items.sort(compare);",
        ].join("\n"),
      }),
    );

    expect(detail).toEqual({
      kind: "search",
      command: "rg -n 'compare|sort' src/community",
      query: "compare|sort",
      output: [
        "src/community/materialize-messages.ts:20:const compare = sortEvents();",
        "src/community/materialize-messages.ts:42:items.sort(compare);",
      ].join("\n"),
      matches: [
        {
          path: "src/community/materialize-messages.ts",
          line: 20,
          text: "const compare = sortEvents();",
        },
        {
          path: "src/community/materialize-messages.ts",
          line: 42,
          text: "items.sort(compare);",
        },
      ],
    });
  });

  it("summarizes adjacent tool categories", () => {
    expect(
      transcriptToolGroupLabel([
        tool({ name: "Read Shadcn Svelte skill" }),
        tool({ name: "Read ToolCalls.svelte" }),
        tool({
          name: "bash",
          input: JSON.stringify({ command: "jj --no-pager st" }),
        }),
      ]),
    ).toBe("Loaded a tool, read files, ran commands");
  });

  it("does not treat read payloads with path and content as file edits", () => {
    expect(
      richTranscriptToolDetail(
        tool({
          name: "read_file",
          output: JSON.stringify({
            path: "fixture.ts",
            content: "const x = 1;",
          }),
        }),
      ),
    ).toBeUndefined();
  });

  it("falls back for malformed and unsupported payloads", () => {
    expect(
      richTranscriptToolDetail(
        tool({
          name: "opaque_tool",
          input: "{not-json",
          output: JSON.stringify({ redacted: true }),
          redacted: true,
          truncated: true,
        }),
      ),
    ).toBeUndefined();
  });
});
