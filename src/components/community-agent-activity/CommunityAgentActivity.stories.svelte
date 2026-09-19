<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor, within } from "storybook/test";
  import CommunityAgentActivity from "./CommunityAgentActivity.svelte";
  import Harness from "../community-agents/CommunityAgentsStoryHarness.svelte";
  import {
    storyAgentState,
    storyAgentPubkey,
  } from "../community-agents/story-fixtures.js";
  const { Story } = defineMeta({
    title: "Community/Agents/Activity",
    component: CommunityAgentActivity,
    tags: ["visual-pending"],
    parameters: {
      layout: "fullscreen",
      docs: {
        source: {
          language: "svelte",
          code: `<script>
  import { CommunityAgentActivity } from "@lapismd/lapis-community/components";
<\/script>
<CommunityAgentActivity model={controller.state.agents} {rooms} onLatest={refreshActivity} onLoadOlder={controller.actions.agents.loadOlderActivity} onClearHistory={clearSelectedHistory} />`,
        },
      },
    },
  });
</script>

<Story
  name="Starting before transcript"
  play={async ({ canvas }) => {
    await expect(canvas.getByText("Starting")).toBeVisible();
    await expect(
      canvas.queryByText("Waiting for transcript activity from this agent."),
    ).not.toBeInTheDocument();
  }}
>
  {#snippet template()}
    <CommunityAgentActivity
      model={storyAgentState({
        activityAgent: storyAgentPubkey,
        activity: [
          {
            id: "starting",
            agentPubkey: storyAgentPubkey,
            createdAt: 1700000000,
            frame: {
              version: 2,
              seq: 1,
              kind: "request_status",
              timestamp: "2023-11-14T22:13:20.000Z",
              payload: {
                lifecycleRequestId: "request",
                state: "starting",
                preview: "Starting",
              },
            },
          },
        ],
      })}
      onLatest={() => {}}
      onLoadOlder={() => {}}
      onClearHistory={async () => {}}
    />
  {/snippet}
</Story>

<Story
  name="Timeline"
  play={async ({ canvas, canvasElement }) => {
    const transcript = canvas.getByRole("log", {
      name: "Agent conversation activity",
    });
    await expect(
      within(transcript).getByLabelText("Message from Alex Morgan"),
    ).toBeVisible();
    await expect(
      within(transcript).getByLabelText("Message from Research"),
    ).toBeVisible();
    await expect(
      within(transcript).getAllByText(
        "I’ll review the source before answering.",
      )[0],
    ).toBeVisible();
    await expect(
      within(transcript).getByText("Read source", { exact: true }),
    ).toBeVisible();
    for (const thought of canvasElement.querySelectorAll(
      '[data-ui-component="ai-chat-reasoning"]',
    )) {
      expect(thought).toHaveAttribute("data-streaming", "false");
      expect(
        getComputedStyle(
          thought.querySelector('[data-ui-part="reasoning-icon"]')!,
        ).animationName,
      ).toBe("none");
    }
    expect(canvasElement.querySelector('[data-status="running"]')).toBeNull();
    const times = transcript.querySelectorAll("time");
    await expect(times).toHaveLength(2);
    for (const time of times) {
      await expect(time).toHaveTextContent(/minutes? ago/);
      await expect(time).toHaveAttribute("datetime");
      await expect(time).toHaveAttribute("title");
    }
    const time = times[0]!;
    await userEvent.hover(time);
    await expect(time).toHaveAttribute("aria-describedby");
    await userEvent.unhover(time);
  }}>{#snippet template()}<Harness screen="activity" />{/snippet}</Story
>

<Story
  name="Events and older history"
  play={async ({ canvas }) => {
    for (const text of [
      "Summarize the project updates.",
      "Here are the project updates.",
      "Read source",
      "Permission allow_once for Publish report",
    ])
      await expect(canvas.getByText(text, { exact: true })).toBeVisible();
    const log = canvas.getByRole("log", {
      name: "Agent conversation activity",
    });
    const older = within(log).getByRole("button", {
      name: "Load older activity",
    });
    const message = within(log).getByLabelText("Message from Alex Morgan");
    expect(
      older.compareDocumentPosition(message) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await userEvent.click(older);
    await expect(canvas.getByText("Earlier transcript message")).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Latest", exact: true }),
    );
    await expect(canvas.getByText("Showing latest activity")).toBeVisible();
    const back = canvas.getByRole("button", { name: "Back to profile" });
    await expect(back.closest("header")).not.toBeNull();
    await expect(
      canvas.getByRole("region", { name: "Agent activity history" }),
    ).not.toContainElement(back);
    await userEvent.click(back);
    await expect(
      canvas.getByRole("article", { name: "Research agent profile" }),
    ).toBeVisible();
  }}>{#snippet template()}<Harness screen="activity" />{/snippet}</Story
>
<Story
  name="Fixed agent and context"
  play={async ({ canvas }) => {
    await expect(
      canvas.queryByRole("button", { name: "Activity agent" }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole("button", { name: "Activity channel" }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.getByRole("heading", { name: "Research", exact: true }),
    ).toBeVisible();
    await expect(
      canvas.getAllByText("All conversations", { exact: true })[0],
    ).toBeVisible();
  }}>{#snippet template()}<Harness screen="activity" />{/snippet}</Story
>
<Story
  name="Signer retry"
  play={async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("declined");
    await userEvent.click(
      canvas.getByRole("button", { name: "Latest", exact: true }),
    );
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
    await expect(
      canvas.getByText("Here are the project updates."),
    ).toBeVisible();
  }}
  >{#snippet template()}<Harness
      screen="activity"
      variant="signer-error"
    />{/snippet}</Story
>
<Story name="Controller permission request"
  >{#snippet template()}<Harness
      screen="activity"
      variant="permission"
    />{/snippet}</Story
>
<Story name="Checking for missed activity"
  >{#snippet template()}<Harness
      screen="activity"
      variant="sync-checking"
    />{/snippet}</Story
>
<Story name="Caught up with active work"
  >{#snippet template()}<Harness
      screen="activity"
      variant="sync-active"
    />{/snippet}</Story
>
<Story name="Completed while offline"
  >{#snippet template()}<Harness
      screen="activity"
      variant="sync-completed"
    />{/snippet}</Story
>
<Story name="Activity catch-up unavailable"
  >{#snippet template()}<Harness
      screen="activity"
      variant="sync-unavailable"
    />{/snippet}</Story
>
<Story
  name="Retry activity catch-up"
  play={async ({ canvas }) => {
    await expect(canvas.getByText("Catch-up unavailable")).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Latest", exact: true }),
    );
    await expect(canvas.getByText("Checking activity")).toBeVisible();
  }}
  >{#snippet template()}<Harness
      screen="activity"
      variant="sync-retry"
    />{/snippet}</Story
>
<Story
  name="Controller permissions"
  play={async ({ canvas, canvasElement }) => {
    const controls = canvas.getByRole("region", {
      name: "Agent runtime controls",
    });
    const cancel = within(controls).getByRole("button", {
      name: "Cancel turn",
    });
    const reset = within(controls).getByRole("button", {
      name: "Reset conversation",
    });
    expect(
      Math.abs(
        cancel.getBoundingClientRect().top - reset.getBoundingClientRect().top,
      ),
    ).toBeLessThan(1);
    await expect(
      within(controls).queryByRole("heading", { name: "Runtime controls" }),
    ).not.toBeInTheDocument();
    await expect(
      within(controls).getByText("Waiting for approval"),
    ).toBeVisible();
    await expect(within(controls).getByText("Run test suite")).toBeVisible();
    await expect(within(controls).getByText(/pnpm test/)).toBeVisible();
    await expect(
      within(controls).queryByRole("button", { name: "Always allow" }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      within(controls).getByRole("button", { name: "Allow once" }),
    );
    await expect(canvas.getByText("allow_once sent")).toBeVisible();
    await expect(
      within(controls).queryByRole("article", {
        name: "Permission requested by Research",
      }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      within(controls).getByRole("button", { name: "Cancel turn" }),
    );
    await expect(canvas.getByText("Turn cancellation requested")).toBeVisible();
    await userEvent.click(
      within(controls).getByRole("button", { name: "Reset conversation" }),
    );
    const dialog = within(canvasElement.ownerDocument.body).getByRole(
      "alertdialog",
    );
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: "Reset conversation",
        exact: true,
      }),
    );
    await expect(
      canvas.getByText("Conversation reset requested"),
    ).toBeVisible();
  }}
  >{#snippet template()}<Harness
      screen="activity"
      variant="permission"
    />{/snippet}</Story
>
<Story name="Storage failure"
  >{#snippet template()}<Harness
      screen="activity"
      variant="storage-error"
    />{/snippet}</Story
>
<Story name="Memory fallback"
  >{#snippet template()}<Harness
      screen="activity"
      variant="memory"
    />{/snippet}</Story
>
<Story
  name="Empty"
  play={async ({ canvas }) => {
    await expect(canvas.getByText("No saved activity here yet")).toBeVisible();
    await expect(
      canvas.queryByText("Loading activity", { exact: true }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: "Latest", exact: true }),
    ).toBeEnabled();
  }}
  >{#snippet template()}<Harness
      screen="activity"
      variant="empty"
    />{/snippet}</Story
>
<Story name="Narrow"
  >{#snippet template()}<Harness screen="activity" narrow />{/snippet}</Story
>
<Story
  name="Clear agent history"
  play={async ({ canvas, canvasElement }) => {
    await expect(
      canvas.getByRole("button", { name: "Clear this agent’s saved activity" }),
    ).toHaveAttribute("data-variant", "destructive");
    await userEvent.click(
      canvas.getByRole("button", { name: "Clear this agent’s saved activity" }),
    );
    const dialog = within(canvasElement.ownerDocument.body).getByRole(
      "alertdialog",
    );
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: "Clear history",
        exact: true,
      }),
    );
    await expect(canvas.getByText("No saved activity here yet")).toBeVisible();
  }}>{#snippet template()}<Harness screen="activity" />{/snippet}</Story
>
