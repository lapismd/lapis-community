<script module lang="ts">
  import consumerSource from "../community-patterns/examples/AgentDiscussionExample.svelte?raw";
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, waitFor } from "storybook/test";
  import CommunityAgentContextMessage from "./CommunityAgentContextMessage.svelte";
  import Harness from "../../testing/AgentConversationHarness.svelte";
  import {
    message,
    request,
    response,
    signOwner,
  } from "../../testing/agent-conversation-fixture.js";
  const onOpen = fn();
  const onPublish = fn();
  const reaction = signOwner({
    kind: 7,
    created_at: response.created_at + 1,
    content: "👍",
    tags: [
      ["h", "room"],
      ["e", response.id],
      ["p", response.pubkey],
    ],
  });
  const { Story } = defineMeta({
    title: "Community/Agents/Context Message",
    component: CommunityAgentContextMessage,
    tags: ["visual-pending"],
    parameters: {
      docs: { source: { code: consumerSource, language: "svelte" } },
    },
    args: { message, channelId: "room", requestId: request.id },
  });
</script>

<Story
  name="Reply to native message"
  play={async ({ canvas, canvasElement }) => {
    await expect(
      canvasElement.querySelector(
        '[data-ui-component="community-member-avatar"]',
      ),
    ).toHaveAttribute("data-shape", "rounded");
    await userEvent.hover(
      await canvas.findByRole("article", { name: "Message from Nyra" }),
    );
    const reply = await canvas.findByRole("button", {
      name: "Reply in thread",
    });
    for (let i = 0; i < 12 && reply.ownerDocument.activeElement !== reply; i++)
      await userEvent.tab();
    await expect(reply).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(onOpen).toHaveBeenCalledWith("room", request.id, response.id);
    await expect(canvas.getByRole("status")).toHaveTextContent(request.id);
  }}
>
  {#snippet template(args)}<Harness {onOpen}
      ><CommunityAgentContextMessage {...args} /></Harness
    >{/snippet}
</Story>
<Story
  name="Historical transcript stays read only"
  args={{ message: { ...message, sourceEventId: undefined } }}
  play={async ({ canvas }) => {
    await expect(canvas.getByText(message.text)).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: "Reply in thread" }),
    ).toBeNull();
  }}
/>

<Story
  name="Toggle a native message reaction"
  play={async ({ canvas }) => {
    const selected = await canvas.findByRole("button", {
      name: "1 reaction with 👍",
    });
    await expect(selected).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(selected);
    await waitFor(() =>
      expect(onPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 5,
          tags: expect.arrayContaining([["e", reaction.id]]),
        }),
      ),
    );
    await waitFor(() =>
      expect(
        canvas.queryByRole("button", { name: "1 reaction with 👍" }),
      ).not.toBeInTheDocument(),
    );
  }}
>
  {#snippet template(args)}<Harness {onPublish} extraEvents={[reaction]}
      ><CommunityAgentContextMessage {...args} /></Harness
    >{/snippet}
</Story>
