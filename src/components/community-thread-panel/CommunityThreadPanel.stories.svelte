<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent } from "storybook/test";

  import {
    communityStoryMembers,
    communityStoryThread,
  } from "../community-workspace/story-fixtures.js";
  import CommunityThreadPanel from "./CommunityThreadPanel.svelte";

  const { Story } = defineMeta({
    title: "Community/Channels/Thread Panel",
    component: CommunityThreadPanel,
    tags: ["visual-pending"],
    parameters: {
      docs: {
        description: {
          component:
            "The thread sidebar has its own scroll-to-latest recovery control and scroll state, independent from the main conversation.",
        },
      },
    },
  });
</script>

<Story
  name="Nested replies shown chronologically"
  args={{
    thread: communityStoryThread,
    members: communityStoryMembers,
    onSendReply: fn(),
    onToggleReaction: fn(),
    onAddReaction: fn(),
    onCopyMessageLink: fn(),
    onDeleteMessage: fn(),
    onReply: fn(),
    onCancelReply: fn(),
    replyTarget: {
      eventId: "thread-1",
      roomId: "general",
      authorId: "mara",
      authorName: "Mara Chen",
      content:
        "Confirmed here too. The approval is visible in the public read model but the relay still treats it as an ordinary signed message.",
      kind: "channel",
    },
  }}
  play={async ({ canvas, args }) => {
    const composer = canvas.getByRole("combobox", { name: "Message" });
    await expect(canvas.queryByLabelText("Thread from Ben Stone")).toBeNull();
    await expect(
      canvas
        .getByLabelText("Replying to Mara Chen")
        .closest('[data-ui-component="ai-chat-composer-drawer"]'),
    ).toBeVisible();
    await expect(
      canvas.getAllByText(/I have published the AI plugin fixture/u)[0],
    ).toBeVisible();
    await userEvent.type(composer, "An isolated thread reply");
    await userEvent.keyboard("{Enter}");
    await expect(args.onSendReply).toHaveBeenCalledWith(
      "message-release",
      "An isolated thread reply",
    );

    await userEvent.click(
      canvas.getByRole("button", { name: "2 reactions with 👍" }),
    );
    await expect(args.onToggleReaction).toHaveBeenCalledWith("thread-1", "👍");

    await userEvent.click(canvas.getAllByRole("button", { name: "Reply" })[0]!);
    await expect(args.onReply).toHaveBeenCalledWith("thread-1");
    await userEvent.click(canvas.getByRole("button", { name: "Cancel reply" }));
    await expect(args.onCancelReply).toHaveBeenCalledOnce();
  }}
>
  {#snippet template(args)}
    <div
      style="width: min(100%, 28rem); height: 38rem; border: 1px solid var(--border);"
    >
      <CommunityThreadPanel {...args} />
    </div>
  {/snippet}
</Story>
