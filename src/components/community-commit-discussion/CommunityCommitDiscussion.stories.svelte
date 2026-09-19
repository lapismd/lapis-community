<script module lang="ts">
  import consumerSource from "../community-patterns/examples/AgentDiscussionExample.svelte?raw";
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, waitFor } from "storybook/test";
  import CommunityCommitDiscussion from "./CommunityCommitDiscussion.svelte";
  import CommunityAgentThreadContext from "../community-agent-thread-context/CommunityAgentThreadContext.svelte";
  import Harness from "../../testing/AgentConversationHarness.svelte";
  import {
    checkpoint,
    request,
    commit,
    signOwner,
  } from "../../testing/agent-conversation-fixture.js";
  import { createCommitComment } from "../../projects/commit-comments.js";
  const comment = signOwner(
    createCommitComment(
      checkpoint,
      commit,
      request.id,
      "Clarify the review workflow.",
      { anchor: { path: "README", side: "new", line: 1 } },
    ),
  );
  const onPublish = fn();
  const { Story } = defineMeta({
    title: "Community/Projects/Commit discussion",
    component: CommunityCommitDiscussion,
    tags: ["visual-pending"],
    parameters: {
      docs: { source: { code: consumerSource, language: "svelte" } },
    },
    parameters: {
      docs: {
        source: {
          code: "<CommunityCommitDiscussion {comments} inThread />",
          language: "svelte",
        },
      },
    },
  });
</script>

<Story
  name="Review reply stays in the original thread"
  play={async ({ canvas, canvasElement }) => {
    await canvas.findByText("Clarify the review workflow.");
    const reply = canvas.getByRole("button", { name: "Reply in thread" });
    for (let i = 0; i < 35 && reply.ownerDocument.activeElement !== reply; i++)
      await userEvent.tab();
    await expect(reply).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(await canvas.findByRole("status")).toHaveTextContent(
      request.id,
    );
    const editor = await canvas.findByRole("textbox", {
      name: "Markdown editor",
    });
    await userEvent.click(editor);
    await userEvent.paste("Agreed; keep this tied to the original revision.");
    await userEvent.click(
      canvas.getByRole("button", { name: "Reply", exact: true }),
    );
    await waitFor(() => expect(onPublish).toHaveBeenCalled());
    expect(onPublish.mock.lastCall?.[0].tags).toContainEqual(["e", comment.id]);
    expect(onPublish.mock.lastCall?.[0].kind).toBe(1111);
    expect(onPublish.mock.lastCall?.[0].tags).toContainEqual(["K", "3907"]);
    await expect(canvas.queryByRole("textbox")).not.toBeInTheDocument();
  }}
>
  {#snippet template()}<Harness {onPublish} extraEvents={[comment]}
      ><CommunityAgentThreadContext
        rootId={request.id}
        messageId={request.id}
        roomId="room"
      /></Harness
    >{/snippet}
</Story>
