<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, waitFor, within } from "storybook/test";
  import CommunityDiscussionMessage from "./CommunityDiscussionMessage.svelte";
  import Harness from "../../testing/AgentConversationHarness.svelte";
  import { request, owner } from "../../testing/agent-conversation-fixture.js";
  import { conversationMessage } from "../community-agent-conversation/model.js";
  const onPublish = fn();
  const { Story } = defineMeta({
    title: "Community/Agents/Discussion Message",
    component: CommunityDiscussionMessage,
    tags: ["visual-pending"],
    parameters: {
      docs: {
        source: {
          code: "<CommunityDiscussionMessage {message} {author} />",
          language: "svelte",
        },
      },
    },
    args: {
      message: conversationMessage(request, []),
      author: {
        id: owner,
        name: "Operator",
        initials: "OP",
        handle: "operator",
      },
    },
  });
</script>

<Story
  name="Edit and copy through the ordinary message menu"
  play={async ({ canvas, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const message = canvas.getByRole("article", {
      name: "Message from Operator",
    });
    await userEvent.hover(message);
    await waitFor(() =>
      expect(message).toHaveAttribute("data-actions-visible"),
    );
    await userEvent.click(
      await canvas.findByRole("button", { name: "More message actions" }),
    );
    for (const name of [
      "Copy message",
      "Copy event",
      "Copy message link",
      "Delete message",
    ])
      await expect(
        await body.findByRole("menuitem", { name, exact: true }),
      ).toBeVisible();
    await userEvent.click(
      body.getByRole("menuitem", { name: "Edit message", exact: true }),
    );
    const editor = await canvas.findByRole("textbox", {
      name: "Markdown editor",
    });
    await waitFor(() =>
      expect(getComputedStyle(editor).pointerEvents).not.toBe("none"),
    );
    await userEvent.click(editor);
    await userEvent.clear(editor);
    await userEvent.paste(
      "Updated request with the original discussion intact.",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(onPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 40003,
          tags: [
            ["h", "room"],
            ["e", request.id],
          ],
        }),
      ),
    );
    await expect(
      await canvas.findByText(
        "Updated request with the original discussion intact.",
      ),
    ).toBeVisible();
    await expect(canvas.getByText("(edited)")).toBeVisible();
    await expect(canvas.queryByRole("textbox")).not.toBeInTheDocument();
  }}
>
  {#snippet template(args)}<Harness {onPublish}
      ><CommunityDiscussionMessage {...args} /></Harness
    >{/snippet}
</Story>
