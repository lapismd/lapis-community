<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import CommunityAgentActivity from "./CommunityAgentActivity.svelte";
  import {
    storyAgentState,
    storyAgentPubkey,
  } from "../community-agents/story-fixtures.js";
  import { canonicalLocalRecords } from "../../fixture/canonical-agent-records.js";
  import type { CommunityAgentActivityItem } from "../../community/agent-contracts.js";
  const activity: CommunityAgentActivityItem[] = canonicalLocalRecords(
    1700000000,
  ).map((record) => ({
    id: record.id,
    agentPubkey: storyAgentPubkey,
    createdAt: record.sequence,
    frame: {
      version: 2,
      seq: record.sequence,
      sessionId: "fixture-session",
      turnId: "fixture-turn",
      timestamp: new Date(record.created_at_ms).toISOString(),
      kind: "transcript_record",
      payload: {
        capture: {
          schema: "lapis.transcript-fragment/1",
          recordId: record.id,
          sequence: record.sequence,
          index: 0,
          count: 1,
          data: record.text,
        },
      },
    },
  }));
  const { Story } = defineMeta({
    title: "Community/Agents/Canonical Activity",
    component: CommunityAgentActivity,
    tags: ["visual-pending"],
    parameters: {
      docs: {
        source: {
          code: "<CommunityAgentActivity model={controller.state.agents} />",
        },
      },
    },
  });
</script>

<Story
  name="Completed sanitized records"
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole("button", { name: /Plan/ }));
    await expect(
      canvas.getByText(/Inspect README and update the checkpoint guide/),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: /Capture gap/ }));
    await expect(
      canvas.getByText("An external provider did not expose this event."),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: /Capture coverage/ }),
    );
    await expect(
      canvas.getByText(/Unobserved: native-provider-traffic/),
    ).toBeVisible();
    expect(canvasElement.querySelector('[data-streaming="true"]')).toBeNull();
    expect(canvasElement.querySelector('[data-status="running"]')).toBeNull();
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
