<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent } from "storybook/test";

  import {
    communityStoryMembers,
    communityStoryMessages,
    communityStoryNavigation,
  } from "../community-workspace/story-fixtures.js";
  import CommunityConversation from "./CommunityConversation.svelte";

  const generalRoom = communityStoryNavigation[0]!.rooms[1]!;
  const groupedMessages = [
    ...communityStoryMessages,
    {
      ...communityStoryMessages.at(-1)!,
      id: "message-docs-follow-up",
      timestamp: "09:39",
      createdAt: "2026-09-02T09:39:00Z",
      content: "I will link the guide from the AI package support forum too.",
    },
  ];

  const { Story } = defineMeta({
    title: "Community/Channels/Conversation",
    component: CommunityConversation,
    tags: ["visual-pending"],
    parameters: {
      docs: {
        description: {
          component:
            "The shared channel, Inbox, and direct-message conversation includes an independent scroll-to-latest recovery control.",
        },
      },
    },
  });
</script>

<Story
  name="Compact channel feed"
  args={{
    room: generalRoom,
    messages: groupedMessages,
    members: communityStoryMembers,
    onSend: fn(),
    onReply: fn(),
    onOpenThread: fn(),
    onToggleReaction: fn(),
    onAddReaction: fn(),
    onCopyMessageLink: fn(),
    onDeleteMessage: fn(),
  }}
>
  {#snippet template(args)}
    <div
      style="width: min(100%, 54rem); height: 38rem; border: 1px solid var(--border);"
    >
      <CommunityConversation {...args} />
    </div>
  {/snippet}
</Story>

<Story
  name="Reply context drawer"
  args={{
    room: generalRoom,
    messages: groupedMessages,
    members: communityStoryMembers,
    replyTarget: {
      eventId: "message-release",
      roomId: generalRoom.id,
      authorId: communityStoryMembers[0]!.id,
      authorName: "Ada Lovelace",
      content:
        "I have published the AI plugin fixture so the release can be reviewed.",
      kind: generalRoom.kind,
    },
    onSend: fn(),
    onCancelReply: fn(),
  }}
  play={async ({ canvas, args }) => {
    const context = await canvas.findByLabelText("Replying to Ada Lovelace");
    await expect(context).toBeVisible();
    await expect(
      context.closest('[data-ui-component="ai-chat-composer-drawer"]'),
    ).toBeVisible();
    await expect(
      canvas.getByText(
        "I have published the AI plugin fixture so the release can be reviewed.",
      ),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Cancel reply" }));
    await expect(args.onCancelReply).toHaveBeenCalledOnce();
  }}
>
  {#snippet template(args)}
    <div
      style="width: min(100%, 54rem); height: 38rem; border: 1px solid var(--border);"
    >
      <CommunityConversation {...args} />
    </div>
  {/snippet}
</Story>
