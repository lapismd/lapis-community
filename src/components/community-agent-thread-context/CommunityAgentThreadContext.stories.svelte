<script module lang="ts">
  import consumerSource from "../community-patterns/examples/AgentDiscussionExample.svelte?raw";
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import CommunityAgentThreadContext from "./CommunityAgentThreadContext.svelte";
  import Harness from "../../testing/AgentConversationHarness.svelte";
  import {
    request,
    response,
  } from "../../testing/agent-conversation-fixture.js";
  const { Story } = defineMeta({
    title: "Community/Agents/Thread context",
    component: CommunityAgentThreadContext,
    tags: ["visual-pending"],
    parameters: {
      docs: {
        source: {
          code: consumerSource,
          language: "svelte",
        },
      },
    },
  });
</script>

<Story
  name="Completed thinking and tools beside the original request"
  play={async ({ canvas, canvasElement }) => {
    const thinking = await canvas.findByRole("button", { name: /Thinking/ });
    await userEvent.click(thinking);
    await expect(
      await canvas.findByText("Inspecting the README before editing."),
    ).toBeVisible();
    expect(canvasElement.querySelector('[data-streaming="true"]')).toBeNull();
    await expect(canvas.queryByText(response.content)).not.toBeInTheDocument();
  }}
>
  {#snippet template()}<Harness
      ><CommunityAgentThreadContext
        rootId={request.id}
        messageId={request.id}
        roomId="room"
      /></Harness
    >{/snippet}
</Story>
