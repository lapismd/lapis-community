import { expect, it } from "vitest";
import type { Snippet } from "svelte";
import { transcriptToolProps } from "./transcript-tool-props.js";

const detail = (() => {}) as unknown as Snippet<
  [{ data?: unknown; name?: string }]
>;

it("exposes command and kind targets while keeping the invocation name", () => {
  const props = transcriptToolProps(
    {
      id: "exec",
      type: "tool",
      toolId: "exec",
      name: "bash",
      state: "completed",
      input: JSON.stringify({
        command: "git status",
        kind: "execute",
        locations: [{ path: "README.md" }],
      }),
      output: "On branch main",
      createdAt: new Date(1_700_000_000_000).toISOString(),
    },
    detail,
  );
  expect(props.name).toBe("bash");
  expect(props.target).toBe("git status");
});
