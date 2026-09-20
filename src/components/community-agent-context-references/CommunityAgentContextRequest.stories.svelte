<script module lang="ts">
  import consumerSource from "../community-patterns/examples/AgentDiscussionExample.svelte?raw";
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "storybook/test";
  import CommunityAgentContextReferences from "./CommunityAgentContextReferences.svelte";
  import Harness from "../../testing/AgentConversationHarness.svelte";
  import {
    checkpoint,
    request,
    signOwner,
  } from "../../testing/agent-conversation-fixture.js";
  const followup = signOwner({
    kind: 9,
    created_at: 1700000005,
    tags: [
      ["h", "room"],
      ["e", request.id, "", "root"],
    ],
    content: "Please address the review",
  });
  const followupCheckpoint = {
    ...checkpoint,
    records: checkpoint.records.map((record) =>
      record.kind === "user_message"
        ? { ...record, sourceEventId: followup.id }
        : record,
    ),
  };
  const { Story } = defineMeta({
    title: "Community/Projects/Agent Context Request",
    component: CommunityAgentContextReferences,
    tags: ["visual-pending"],
    parameters: {
      docs: { source: { code: consumerSource, language: "svelte" } },
    },
  });
</script>

<Story
  name="Follow-up request outside loaded channel history"
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Agent context references" }),
    );
    await userEvent.click(
      within(canvasElement.ownerDocument.body).getByRole("menuitem", {
        name: `Open request ${followup.id}`,
      }),
    );
    await expect(await canvas.findByRole("status")).toHaveTextContent(
      `Thread ${request.id}`,
    );
  }}
>
  {#snippet template()}
    <Harness extraEvents={[followup]}>
      <CommunityAgentContextReferences checkpoints={[followupCheckpoint]} />
    </Harness>
  {/snippet}
</Story>
