<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import CommunityAgentActivity from "./CommunityAgentActivity.svelte";
  import {
    storyAgentPubkey,
    storyAgentState,
  } from "../community-agents/story-fixtures.js";

  const { Story } = defineMeta({
    title: "Community/Agents/Turn delivery status",
    component: CommunityAgentActivity,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Reply and checkpoint completion stay separate"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("tab", { name: "Turns" }));
    await expect(canvas.getByText("Reply delivery pending")).toBeVisible();
    await expect(canvas.getByText("Checkpoint sync pending")).toBeVisible();
    await expect(canvas.getByText("Reply delivered")).toBeVisible();
    await expect(canvas.getByText("Checkpoint synced")).toBeVisible();
    await expect(
      canvas.getAllByText("Completed", { exact: true }),
    ).toHaveLength(2);
  }}
>
  {#snippet template()}
    <CommunityAgentActivity
      model={storyAgentState({
        activityAgent: storyAgentPubkey,
        conversationScopes: {
          pending: {
            agentPubkey: storyAgentPubkey,
            scopeKey: "scope/pending",
            sessionId: "session-pending",
            turnId: "turn-pending",
            state: "completed",
            active: false,
            replyDelivery: "pending",
            checkpointSync: "pending",
          },
          complete: {
            agentPubkey: storyAgentPubkey,
            scopeKey: "scope/complete",
            sessionId: "session-complete",
            turnId: "turn-complete",
            state: "completed",
            active: false,
            replyDelivery: "delivered",
            checkpointSync: "completed",
          },
        },
      })}
      onLatest={() => {}}
      onLoadOlder={() => {}}
      onClearHistory={async () => {}}
    />
  {/snippet}
</Story>
