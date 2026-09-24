<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "storybook/test";
  import CommunityAgentTranscript from "./CommunityAgentTranscript.svelte";
  import {
    storyActivity,
    storyAgent,
  } from "../community-agents/story-fixtures.js";

  const { Story } = defineMeta({
    title: "Community/Agents/Activity transcript rich tools",
    component: CommunityAgentTranscript,
    tags: ["visual-pending"],
    parameters: {
      docs: {
        source: { code: "<CommunityAgentTranscript {activity} {agent} />" },
      },
    },
  });

  const toolTime = new Date(1_700_000_000_000).toISOString();
  function toolEntry(
    patch: Record<string, unknown>,
    index = 1,
  ): ReturnType<typeof storyActivity> {
    return storyActivity(
      "tool_call_update",
      {
        entry: {
          id: `tool-${index}`,
          type: "tool",
          toolId: `tool-${index}`,
          name: "Tool",
          state: "completed",
          createdAt: toolTime,
          ...patch,
        },
      },
      index,
    );
  }
</script>

<Story
  name="Edited file rich view"
  args={{
    agent: storyAgent,
    activity: [
      toolEntry({
        name: "Edit File",
        input: JSON.stringify({ kind: "edit" }),
        output: JSON.stringify([
          {
            path: "fixture.ts",
            type: "diff",
            content: [
              "diff --git a/fixture.ts b/fixture.ts",
              "--- a/fixture.ts",
              "+++ b/fixture.ts",
              "@@ -1 +1 @@",
              '-export const smokeValue = "old";',
              '+export const smokeValue = "new";',
            ].join("\n"),
          },
        ]),
      }),
    ],
  }}
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Show details for Edited file" }),
    );
    const fileDiff = canvasElement.querySelector<HTMLElement>(
      '[data-ui-component="file-diff"][data-diff-file-path="fixture.ts"]',
    );
    const fileHeader = canvasElement.querySelector<HTMLElement>(
      '.transcript-tool-rich__file[aria-label="Diff for fixture.ts"] .transcript-tool-rich__file-header',
    );
    expect(fileHeader).not.toBeNull();
    await expect(within(fileHeader!).getByText("fixture.ts")).toBeVisible();
    await expect(within(fileHeader!).getByText("+1")).toBeVisible();
    await expect(within(fileHeader!).getByText("−1")).toBeVisible();
    expect(fileDiff).not.toBeNull();
    expect(getComputedStyle(fileDiff!).overflow).toBe("hidden");
    expect(
      fileDiff!.querySelector(
        '[data-ui-component="scroll-area"][data-ui-part="scroll-area"]',
      ),
    ).not.toBeNull();
    expect(canvasElement.textContent).toContain("smokeValue");
    expect(canvasElement.textContent).toContain("+1");
    expect(canvasElement.textContent).toContain("−1");
  }}
/>

<Story
  name="Shell command rich view"
  args={{
    agent: storyAgent,
    activity: [
      toolEntry({
        name: "bash",
        input: JSON.stringify({
          command: "pnpm test -- transcript-tool-rich.test.ts",
        }),
        output: JSON.stringify({ stdout: "Tests: 6 passed" }),
      }),
    ],
  }}
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: /Show details for Ran pnpm test/ }),
    );
    await expect(canvas.getByText(/Shell/)).toBeVisible();
    await expect(
      canvas.getByText(/\$ pnpm test -- transcript-tool-rich\.test\.ts/),
    ).toBeVisible();
    await expect(canvas.getByText("Tests: 6 passed")).toBeVisible();
  }}
/>

<Story
  name="Search results rich view"
  args={{
    agent: storyAgent,
    activity: [
      toolEntry({
        name: "bash",
        input: JSON.stringify({
          command: "rg -n 'compare|sort' src/community",
        }),
        output: [
          "src/community/materialize-messages.ts:20:const compare = sortEvents();",
          "src/community/materialize-messages.ts:42:items.sort(compare);",
        ].join("\n"),
      }),
    ],
  }}
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", {
        name: "Show details for Searched for compare|sort",
      }),
    );
    await expect(canvas.getByText("Search")).toBeVisible();
    await expect(
      canvas.getByText("src/community/materialize-messages.ts:20"),
    ).toBeVisible();
    await expect(
      canvas.getByText("const compare = sortEvents();"),
    ).toBeVisible();
  }}
/>

<Story
  name="Grouped tool summary"
  args={{
    agent: storyAgent,
    activity: [
      toolEntry({ name: "Read Shadcn Svelte skill" }, 1),
      toolEntry({ name: "Read ToolCalls.svelte" }, 2),
      toolEntry(
        {
          name: "bash",
          input: JSON.stringify({ command: "jj --no-pager st" }),
          output: "The working copy has no changes.",
        },
        3,
      ),
    ],
  }}
  play={async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", {
        name: "Expand Loaded a tool, read files, ran commands",
      }),
    ).toBeVisible();
  }}
/>
