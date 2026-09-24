<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import CommunityAgentActivity from "./CommunityAgentActivity.svelte";
  import {
    storyAgentPubkey,
    storyAgentState,
  } from "../community-agents/story-fixtures.js";
  import type { AgentTurnState } from "../../community/agent-turn-state.js";
  const states: AgentTurnState[] = [
    "queued",
    "starting",
    "waiting_permission",
    "waiting_input",
    "completed",
    "failed",
    "cancelled",
    "interrupted",
    "uncertain",
    "unknown",
  ];
  const { Story } = defineMeta({
    title: "Community/Agents/Turn states",
    component: CommunityAgentActivity,
    tags: ["visual-pending"],
    parameters: {
      docs: {
        source: {
          code: "<CommunityAgentActivity {model} {onLatest} {onLoadOlder} {onClearHistory} />",
          language: "svelte",
        },
      },
    },
  });
</script>

<Story
  name="Waiting and terminal turns stay still"
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole("tab", { name: "Turns" }));
    for (const label of [
      "Queued",
      "Starting",
      "Waiting for your permission",
      "Waiting for your answer",
      "Completed",
      "Failed",
      "Cancelled",
      "Outcome uncertain",
      "Status unavailable",
    ])
      await expect(canvas.getByText(label, { exact: true })).toBeVisible();
    expect(canvasElement.querySelector('[data-streaming="true"]')).toBeNull();
    expect(
      canvas.queryByText("Working", { exact: true }),
    ).not.toBeInTheDocument();
  }}
>
  {#snippet template()}
    <CommunityAgentActivity
      model={storyAgentState({
        activityAgent: storyAgentPubkey,
        conversationScopes: Object.fromEntries(
          states.map((state) => [
            state,
            {
              agentPubkey: storyAgentPubkey,
              scopeKey: `scope/${state}`,
              sessionId: state,
              turnId: state,
              state,
              active: !["completed", "failed", "cancelled"].includes(state),
            },
          ]),
        ),
      })}
      onLatest={() => {}}
      onLoadOlder={() => {}}
      onClearHistory={async () => {}}
    />
  {/snippet}
</Story>

<Story
  name="Requested and effective policy are distinct"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("tab", { name: "Turns" }));
    await expect(
      canvas.getByText("Requested: Allow all", { exact: true }),
    ).toBeVisible();
    await expect(
      canvas.getByText("Effective: Ask (restricted session)", { exact: true }),
    ).toBeVisible();
    await expect(
      canvas.getByText("Provider mode bypass: rejected", { exact: true }),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <CommunityAgentActivity
      model={storyAgentState({
        activityAgent: storyAgentPubkey,
        conversationScopes: {
          request: {
            agentPubkey: storyAgentPubkey,
            scopeKey: "scope",
            sessionId: "session",
            turnId: "turn",
            state: "failed",
            active: false,
            executionPolicy: {
              requested: "allow-all",
              effective: "ask",
              restricted: true,
              nativeMode: { requested: "bypass", status: "rejected" },
            },
          },
        },
      })}
      onLatest={() => {}}
      onLoadOlder={() => {}}
      onClearHistory={async () => {}}
    />
  {/snippet}
</Story>
