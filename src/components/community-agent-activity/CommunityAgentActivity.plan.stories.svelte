<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect } from "storybook/test";
  import CommunityAgentActivity from "./CommunityAgentActivity.svelte";
  import {
    storyAgentPubkey,
    storyAgentState,
  } from "../community-agents/story-fixtures.js";
  import type { CommunityAgentActivityItem } from "../../community/agent-contracts.js";

  const createdAt = "2023-11-14T22:13:21.000Z";
  const activity: CommunityAgentActivityItem[] = [
    {
      id: "plan-1",
      agentPubkey: storyAgentPubkey,
      createdAt: 1_700_000_001,
      frame: {
        version: 2,
        seq: 1,
        turnId: "turn",
        kind: "plan_updated",
        timestamp: createdAt,
        payload: {
          entry: {
            id: "run:plan",
            type: "plan",
            entries: [
              { content: "Inspect the catalog", status: "completed" },
              { content: "Write the Activity list", status: "in_progress" },
              { content: "Clear an empty snapshot", status: "pending" },
            ],
            createdAt,
          },
        },
      },
    },
  ];

  const { Story } = defineMeta({
    title: "Community/Agents/Activity",
    component: CommunityAgentActivity,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Live plan snapshot"
  play={async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "Plan" })).toBeVisible();
    await expect(canvas.getByText("Inspect the catalog")).toBeVisible();
    await expect(canvas.getByText("Write the Activity list")).toBeVisible();
    await expect(canvas.getByText("Clear an empty snapshot")).toBeVisible();
    await expect(canvas.getByText("Completed")).toBeVisible();
    await expect(canvas.getByText("In progress")).toBeVisible();
    await expect(canvas.getByText("Pending")).toBeVisible();
  }}
>
  {#snippet template()}
    <CommunityAgentActivity
      model={storyAgentState({ activityAgent: storyAgentPubkey, activity })}
      onLatest={() => {}}
      onLoadOlder={() => {}}
      onClearHistory={async () => {}}
    />
  {/snippet}
</Story>
