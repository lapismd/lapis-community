<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor } from "storybook/test";
  import CommunityAgentTranscript from "./CommunityAgentTranscript.svelte";
  import {
    storyActivity,
    storyAgent,
  } from "../community-agents/story-fixtures.js";

  const { Story } = defineMeta({
    title: "Community/Agents/Activity transcript thread layout",
    component: CommunityAgentTranscript,
    tags: ["visual-pending"],
    parameters: {
      docs: {
        source: { code: "<CommunityAgentTranscript {activity} {agent} />" },
      },
    },
  });

  const timestamp = new Date(1_700_000_000_000).toISOString();
  const activity = [
    storyActivity(
      "thinking_chunk",
      {
        entry: {
          id: "thinking-layout",
          type: "thinking",
          text: "Checking the repository state before changing files.",
          state: "done",
          createdAt: timestamp,
        },
      },
      1,
    ),
    storyActivity(
      "tool_call_update",
      {
        entry: {
          id: "tool-layout-read",
          type: "tool",
          toolId: "read",
          name: "Read source",
          state: "completed",
          output: "Found the relevant transcript row.",
          createdAt: timestamp,
        },
      },
      2,
    ),
    storyActivity(
      "tool_call_update",
      {
        entry: {
          id: "tool-layout-command",
          type: "tool",
          toolId: "command",
          name: "Run command",
          state: "completed",
          input: '{"command":"pnpm check:svelte"}',
          output: "No diagnostics reported.",
          createdAt: timestamp,
        },
      },
      3,
    ),
    storyActivity(
      "permission_resolved",
      {
        entry: {
          id: "permission-layout",
          type: "permission",
          requestId: "permission-layout",
          tool: 'ls -la "$WORKSPACE[default]/eb5adb6a8661aa585ad908ed9ffd65afd74c3775e5730201ee46506e758d9e15/jj-nostr-probe" && rg -n license .',
          options: ["allow_once", "reject_once"],
          state: "resolved",
          decision: "allow-once",
          createdAt: timestamp,
        },
      },
      4,
    ),
  ];
</script>

<Story
  name="Thread row alignment"
  args={{ agent: storyAgent, activity }}
  play={async ({ canvas, canvasElement }) => {
    const timedRows = canvasElement.querySelectorAll<HTMLElement>(
      '[data-ui-part="transcript-timed-row"]',
    );
    expect(timedRows.length).toBeGreaterThanOrEqual(2);

    const firstTime = timedRows[0]!.querySelector<HTMLElement>(
      '[data-ui-part="transcript-timed-row-time"]',
    );
    expect(firstTime).not.toBeNull();
    expect(firstTime!.textContent?.trim()).toBe("22:13");
    expect(firstTime!.getAttribute("title")).toBeTruthy();
    const timeStyle = getComputedStyle(firstTime!);
    expect(timeStyle.width).toBe("44px");
    expect(timeStyle.paddingTop).toBe("12px");
    const toolTime = timedRows[1]!.querySelector<HTMLElement>(
      '[data-ui-part="transcript-timed-row-time"]',
    );
    expect(getComputedStyle(toolTime!).paddingTop).toBe("10px");
    const rowStyle = getComputedStyle(timedRows[0]!);
    expect(rowStyle.gridTemplateColumns.split(" ")[0]).toBe("32px");
    expect(Number(timeStyle.opacity)).toBe(0);
    await userEvent.hover(timedRows[0]!);
    await waitFor(() =>
      expect(Number(getComputedStyle(firstTime!).opacity)).toBeGreaterThan(0.9),
    );

    await expect(
      canvas.getByRole("button", { name: /Expand .*ran commands/i }),
    ).toBeVisible();

    const permission = canvasElement.querySelector<HTMLElement>(
      '[data-ui-part="agent-transcript-permission"]',
    );
    expect(permission).not.toBeNull();
    await expect(permission!).toBeVisible();
    const style = getComputedStyle(permission!);
    expect(style.textAlign).toBe("left");
    expect(style.whiteSpace).toBe("nowrap");
    expect(style.textOverflow).toBe("ellipsis");
  }}
>
  {#snippet template(args)}
    <div class="thread-layout-story">
      <CommunityAgentTranscript {...args} />
    </div>
  {/snippet}
</Story>

<style>
  .thread-layout-story {
    width: min(100%, 34rem);
  }
</style>
